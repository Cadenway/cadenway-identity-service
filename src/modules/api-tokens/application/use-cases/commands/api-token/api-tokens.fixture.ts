import { ApiToken } from '../../../../domain/aggregates/api-token/api-token.aggregate.js';
import type { ApiTokenDraft } from '../../../../domain/value-objects/api-token/api-token-draft.value-object.js';
import type { ApiTokenState } from '../../../../domain/value-objects/api-token/api-token-state.value-object.js';
import type { ActiveMembership } from '../../../models/api-token/active-membership.model.js';
import type { ApiTokenPosition } from '../../../models/api-token/api-token-position.model.js';
import type { IssuedApiToken } from '../../../models/api-token/issued-api-token.model.js';
import type { ActiveMemberships } from '../../../ports/outbound/memberships/api-token/active-memberships.port.js';
import type { ApiTokenRepository } from '../../../ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { ApiTokenSecrets } from '../../../ports/outbound/security/api-token/api-token-secrets.port.js';
import type { Clock } from '../../../ports/outbound/time/api-token/clock.port.js';
import type { ApiTokensUnitOfWork } from '../../../ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';

/**
 * Interface StoredApiToken
 *
 * @description
 * A row of the fake table: the token and the hash of its secret.
 */
export interface StoredApiToken {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * The token.
   *
   * @type {ApiTokenState}
   * @readonly
   */
  readonly state: ApiTokenState;

  /**
   * Property tokenHash
   *
   * @description
   * The hash of its secret.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;
  // #endregion
}

/**
 * Class InMemoryApiTokens
 *
 * @description
 * A fake `ApiTokensUnitOfWork` holding its rows in memory, committed only when the work resolves.
 */
export class InMemoryApiTokens implements ApiTokensUnitOfWork {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * Committed tokens by id.
   *
   * @type {Map<string, StoredApiToken>}
   */
  public rows: Map<string, StoredApiToken> = new Map<string, StoredApiToken>();

  /**
   * Property useWrites
   *
   * @description
   * Writes of a last use committed.
   *
   * @type {number}
   */
  public useWrites: number = 0;

  /**
   * Property ids
   *
   * @description
   * Ids assigned so far.
   *
   * @type {number}
   */
  private ids: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs the work on a copy of the rows, committed when it resolves.
   *
   * @param {(tokens: ApiTokenRepository) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with.
   */
  public async run<TResult>(
    work: (tokens: ApiTokenRepository) => Promise<TResult>,
  ): Promise<TResult> {
    const rows: Map<string, StoredApiToken> = new Map<string, StoredApiToken>(this.rows);
    const writes: { count: number } = { count: this.useWrites };
    const write = (token: ApiToken): void => {
      const stored: StoredApiToken | undefined = rows.get(token.id);
      if (stored !== undefined) {
        rows.set(token.id, { ...stored, state: token.snapshot });
      }
    };
    const repository: ApiTokenRepository = {
      insert: (draft: ApiTokenDraft, tokenHash: string): Promise<ApiToken> => {
        this.ids += 1;
        const state: ApiTokenState = {
          ...draft,
          id: `019a6c30-7a8b-7c9d-8e0f-${String(this.ids).padStart(12, '0')}`,
        };
        rows.set(state.id, { state, tokenHash });
        return Promise.resolve(ApiToken.restore(state));
      },
      listActive: (
        organizationId: string,
        userId: string,
        now: Date,
        after: ApiTokenPosition | null,
        count: number,
      ): Promise<ApiToken[]> => {
        const listed: ApiToken[] = [...rows.values()]
          .map((stored: StoredApiToken) => ApiToken.restore(stored.state))
          .filter(
            (token: ApiToken) =>
              token.belongsTo(userId, organizationId) &&
              token.isActiveAt(now) &&
              (after === null ||
                token.snapshot.createdAt < after.createdAt ||
                (token.snapshot.createdAt.getTime() === after.createdAt.getTime() &&
                  token.id < after.id)),
          )
          .sort(
            (left: ApiToken, right: ApiToken) =>
              right.snapshot.createdAt.getTime() - left.snapshot.createdAt.getTime() ||
              right.id.localeCompare(left.id),
          );
        return Promise.resolve(listed.slice(0, count));
      },
      lock: (organizationId: string, id: string): Promise<ApiToken | null> => {
        const stored: StoredApiToken | undefined = rows.get(id);
        return Promise.resolve(
          stored?.state.organizationId === organizationId ? ApiToken.restore(stored.state) : null,
        );
      },
      revoke: (token: ApiToken): Promise<void> => {
        write(token);
        return Promise.resolve();
      },
      findByTokenHash: (tokenHash: string): Promise<ApiToken | null> => {
        const stored: StoredApiToken | undefined = [...rows.values()].find(
          (row: StoredApiToken) => row.tokenHash === tokenHash,
        );
        return Promise.resolve(stored === undefined ? null : ApiToken.restore(stored.state));
      },
      recordUse: (token: ApiToken): Promise<void> => {
        write(token);
        writes.count += 1;
        return Promise.resolve();
      },
    };
    const result: TResult = await work(repository);
    this.rows = rows;
    this.useWrites = writes.count;
    return result;
  }
  // #endregion
}

/**
 * Class FakeApiTokenSecrets
 *
 * @description
 * Numbered secrets of the contract format, hashed as `hash:<secret>`.
 */
export class FakeApiTokenSecrets implements ApiTokenSecrets {
  // #region Properties
  /**
   * Property issued
   *
   * @description
   * Secrets drawn so far.
   *
   * @type {number}
   */
  private issued: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws the next secret.
   *
   * @returns {IssuedApiToken} The secret, its prefix and its fake hash.
   */
  public issue(): IssuedApiToken {
    this.issued += 1;
    const secret: string = `cw_pat_Test${String(this.issued).padStart(32, '0')}`;
    return { secret, prefix: secret.slice(0, 11), tokenHash: `hash:${secret}` };
  }

  /**
   * Method hashOf
   *
   * @description
   * The fake hash of a secret of the contract format.
   *
   * @param {string} token - The token.
   * @returns {string | null} Its fake hash, or `null`.
   */
  public hashOf(token: string): string | null {
    return /^cw_pat_[0-9A-Za-z]{36}$/u.test(token) ? `hash:${token}` : null;
  }
  // #endregion
}

/**
 * Class FakeActiveMemberships
 *
 * @description
 * A fake copy of the memberships.
 */
export class FakeActiveMemberships implements ActiveMemberships {
  // #region Properties
  /**
   * Property active
   *
   * @description
   * Active memberships by `<organizationId>/<userId>`.
   *
   * @type {Map<string, ActiveMembership>}
   */
  public active: Map<string, ActiveMembership> = new Map<string, ActiveMembership>();
  // #endregion

  // #region Methods
  /**
   * Method join
   *
   * @description
   * Makes an account a member of an organization.
   *
   * @param {string} userId - The account.
   * @param {ActiveMembership} membership - The membership.
   */
  public join(userId: string, membership: ActiveMembership): void {
    this.active.set(`${membership.organizationId}/${userId}`, membership);
  }

  /**
   * Method find
   *
   * @description
   * The active membership of an account in an organization.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The account.
   * @returns {Promise<ActiveMembership | null>} The membership, or `null`.
   */
  public find(organizationId: string, userId: string): Promise<ActiveMembership | null> {
    return Promise.resolve(this.active.get(`${organizationId}/${userId}`) ?? null);
  }
  // #endregion
}

/**
 * Class FixedClock
 *
 * @description
 * A clock that stays on an instant until a spec moves it.
 */
export class FixedClock implements Clock {
  // #region Properties
  /**
   * Property instant
   *
   * @description
   * The current instant, in milliseconds.
   *
   * @type {number}
   */
  private instant: number;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the clock.
   *
   * @param {string} iso - The first instant, ISO 8601.
   * @constructor
   */
  public constructor(iso: string) {
    this.instant = Date.parse(iso);
  }
  // #endregion

  // #region Methods
  /**
   * Method now
   *
   * @description
   * Returns the current instant.
   *
   * @returns {Date} A new date for it.
   */
  public now(): Date {
    return new Date(this.instant);
  }

  /**
   * Method advance
   *
   * @description
   * Moves the clock forward.
   *
   * @param {number} milliseconds - How far.
   */
  public advance(milliseconds: number): void {
    this.instant += milliseconds;
  }
  // #endregion
}
