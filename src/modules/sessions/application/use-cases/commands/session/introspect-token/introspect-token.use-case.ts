import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import { SESSION_SCOPES } from '../../../../../domain/policies/session/session-scopes.policy.js';
import type { ActiveMembership } from '../../../../models/session/active-membership.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { ActiveMemberships } from '../../../../ports/outbound/memberships/session/active-memberships.port.js';
import type { SessionTokens } from '../../../../ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { IntrospectTokenInput } from './introspect-token.input.js';
import type { IntrospectTokenOutput } from './introspect-token.output.js';

/**
 * Class IntrospectToken
 *
 * @description
 * Tells whether the token of a session cookie is active (`POST /internal/v1/tokens/introspect`).
 * The gateway calls it on every request that carries the cookie and never caches the answer, so a
 * revoked session stops at the next request. A malformed, unknown, expired, inactive or revoked
 * token answers `active: false`, never an error. An active answer counts as activity, recorded at
 * most once a minute; calling twice has the effect of calling once.
 *
 * The answer carries the current organization of the session and the role of the account there,
 * from the copy of the memberships, read in the same system transaction: `null` for both when the
 * session has none, or when the membership it acts through is no longer active (a removal), as
 * `ActiveToken.organizationId` of the contract says. A session holds every scope (decision 7).
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
   * Property memberships
   *
   * @description
   * The copy of the memberships.
   *
   * @type {ActiveMemberships}
   * @readonly
   */
  private readonly memberships: ActiveMemberships;

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
   * @param {ActiveMemberships} memberships - The copy of the memberships.
   * @param {Clock} clock - The time of the request.
   * @constructor
   */
  public constructor(
    unitOfWork: SessionsUnitOfWork,
    tokens: SessionTokens,
    memberships: ActiveMemberships,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.tokens = tokens;
    this.memberships = memberships;
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
   * @returns {Promise<IntrospectTokenOutput>} Whether it is active, and its subject when it is.
   */
  public async execute(input: IntrospectTokenInput): Promise<IntrospectTokenOutput> {
    const tokenHash: string | null = this.tokens.hashOf(input.token);
    if (tokenHash === null) {
      return { active: false };
    }
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: SessionsStore): Promise<IntrospectTokenOutput> => {
      const session: Session | null = await store.sessions.findByTokenHash(tokenHash);
      if (!session?.isActiveAt(now)) {
        return { active: false };
      }
      const active: Session = session.recordActivity(now);
      if (active !== session) {
        await store.sessions.recordActivity(active);
      }
      const membership: ActiveMembership | null =
        active.organizationId === null
          ? null
          : await this.memberships.find(active.organizationId, active.userId);
      const current: ActiveMembership | null =
        membership !== null && active.isActingThrough(membership.memberId) ? membership : null;
      return {
        active: true,
        tokenType: 'session',
        sessionId: active.id,
        userId: active.userId,
        organizationId: current?.organizationId ?? null,
        role: current?.role ?? null,
        scopes: [...SESSION_SCOPES],
        expiresAt: active.snapshot.expiresAt,
      };
    });
  }
  // #endregion
}
