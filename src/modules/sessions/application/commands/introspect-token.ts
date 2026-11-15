import type { Session } from '../../domain/session.js';
import type { Clock } from '../ports/clock.port.js';
import type { SessionTokens } from '../ports/session-tokens.port.js';
import type { SessionsStore, SessionsUnitOfWork } from '../ports/sessions-unit-of-work.port.js';

/**
 * Type IntrospectionView
 *
 * @description
 * Whether a token is active and whose it is (`Introspection` of the contract). The organization,
 * the role and the scopes are always empty in this version: a session belongs to an organization
 * once the organization selection exists.
 *
 * @type {{ readonly active: true; readonly tokenType: 'session'; readonly sessionId: string; readonly userId: string; readonly organizationId: null; readonly role: null; readonly scopes: readonly string[]; readonly expiresAt: Date } | { readonly active: false }}
 */
export type IntrospectionView =
  | {
      readonly active: true;
      readonly tokenType: 'session';
      readonly sessionId: string;
      readonly userId: string;
      readonly organizationId: null;
      readonly role: null;
      readonly scopes: readonly string[];
      readonly expiresAt: Date;
    }
  | { readonly active: false };

/**
 * Interface IntrospectTokenInput
 *
 * @description
 * The value of a session cookie (`IntrospectionRequest` of the contract).
 */
export interface IntrospectTokenInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The token; a secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;
  // #endregion
}

/**
 * Class IntrospectToken
 *
 * @description
 * Tells whether the token of a session cookie is active (`POST /internal/v1/tokens/introspect`).
 * The gateway calls it on every request that carries the cookie and never caches the answer, so a
 * revoked session stops at the next request. A malformed, unknown, expired, inactive or revoked
 * token answers `active: false`, never an error. An active answer counts as activity, recorded at
 * most once a minute; calling twice has the effect of calling once.
 */
export class IntrospectToken {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the introspection.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property tokens
   *
   * @description
   * Hashes the presented token.
   *
   * @type {SessionTokens}
   * @readonly
   */
  private readonly tokens: SessionTokens;

  /**
   * Property clock
   *
   * @description
   * The time of the request.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the ports of the introspection.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The transaction of the introspection.
   * @param {SessionTokens} tokens - Hashes the presented token.
   * @param {Clock} clock - The time of the request.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, tokens: SessionTokens, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.tokens = tokens;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Introspects a token.
   *
   * @param {IntrospectTokenInput} input - The value of the cookie.
   * @returns {Promise<IntrospectionView>} Whether it is active, and its subject when it is.
   */
  public async execute(input: IntrospectTokenInput): Promise<IntrospectionView> {
    const tokenHash: string | null = this.tokens.hashOf(input.token);
    if (tokenHash === null) {
      return { active: false };
    }
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: SessionsStore): Promise<IntrospectionView> => {
      const session: Session | null = await store.sessions.findByTokenHash(tokenHash);
      if (!session?.isActiveAt(now)) {
        return { active: false };
      }
      const active: Session = session.recordActivity(now);
      if (active !== session) {
        await store.sessions.recordActivity(active);
      }
      return {
        active: true,
        tokenType: 'session',
        sessionId: active.id,
        userId: active.userId,
        organizationId: null,
        role: null,
        scopes: [],
        expiresAt: active.snapshot.expiresAt,
      };
    });
  }
  // #endregion
}
