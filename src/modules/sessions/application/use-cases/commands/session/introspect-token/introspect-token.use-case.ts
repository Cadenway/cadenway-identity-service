import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import { SESSION_SCOPES } from '../../../../../domain/policies/session/session-scopes.policy.js';
import type { ActiveMembership } from '../../../../models/session/active-membership.model.js';
import { isOrganizationWithheld } from '../../../../services/authentication-policy/organization-access.service.js';
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
 * The answer carries the current organization of the session and the role of the account there.
 * A configured Organization authority is checked outside the transaction. A rollout without
 * that authority reads the copy of the memberships in the system transaction. The answer is
 * `null` for both when the
 * session has none, or when the membership it acts through is no longer active (a removal), as
 * `ActiveToken.organizationId` of the contract says. A session holds every scope (decision 7).
 *
 * The inactivity of the session is the one of the policy of the organization it names (decision 8
 * of P2c). When that policy requires two-step verification for the role of the member, whose account
 * has none, the organization is withheld: `organizationId` and `role` are `null` and
 * `withheldOrganizationId` names it ("Withheld organization" of the internal contract).
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

  /** The live authority, configured independently of the projection used for selection. */
  private readonly authority: Pick<ActiveMemberships, 'find'> | null;
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
   * @param {Pick<ActiveMemberships, 'find'> | null} authority - The live membership authority.
   * @constructor
   */
  public constructor(
    unitOfWork: SessionsUnitOfWork,
    tokens: SessionTokens,
    memberships: ActiveMemberships,
    clock: Clock,
    authority: Pick<ActiveMemberships, 'find'> | null = null,
  ) {
    this.unitOfWork = unitOfWork;
    this.tokens = tokens;
    this.memberships = memberships;
    this.clock = clock;
    this.authority = authority;
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
    const authority = this.authority;
    if (authority === null) {
      return this.unitOfWork.run(async (store): Promise<IntrospectTokenOutput> => {
        const session = await store.sessions.findByTokenHash(tokenHash);
        const now = this.clock.now();
        if (!session?.isActiveAt(now)) {
          return { active: false };
        }
        const membership =
          session.organizationId === null
            ? null
            : await this.memberships.find(session.organizationId, session.userId);
        return this.answer(store, session, now, membership);
      });
    }

    const selected = await this.unitOfWork.run((store) =>
      store.sessions.findByTokenHash(tokenHash),
    );
    if (!selected?.isActiveAt(this.clock.now())) {
      return { active: false };
    }
    const membership =
      selected.organizationId === null
        ? null
        : await authority.find(selected.organizationId, selected.userId);

    return this.unitOfWork.run(async (store): Promise<IntrospectTokenOutput> => {
      const current = await store.sessions.findByTokenHash(tokenHash);
      const now = this.clock.now();
      if (!current?.isActiveAt(now) || current.id !== selected.id) {
        return { active: false };
      }
      const sameSelection =
        current.userId === selected.userId &&
        current.organizationId === selected.organizationId &&
        current.snapshot.memberId === selected.snapshot.memberId;
      return this.answer(store, current, now, sameSelection ? membership : null);
    });
  }

  /** Records activity and applies the local authentication policy to the proven role. */
  private async answer(
    store: SessionsStore,
    session: Session,
    now: Date,
    membership: ActiveMembership | null,
  ): Promise<IntrospectTokenOutput> {
    const active = session.recordActivity(now);
    if (active !== session) {
      await store.sessions.recordActivity(active);
    }
    const acting =
      membership !== null &&
      active.organizationId === membership.organizationId &&
      active.isActingThrough(membership.memberId)
        ? membership
        : null;
    const withheld =
      acting !== null &&
      (await isOrganizationWithheld(store, acting.organizationId, active.userId, acting.role));
    const current = withheld ? null : acting;
    return {
      active: true,
      tokenType: 'session',
      sessionId: active.id,
      userId: active.userId,
      organizationId: current?.organizationId ?? null,
      role: current?.role ?? null,
      scopes: [...SESSION_SCOPES],
      expiresAt: active.snapshot.expiresAt,
      withheldOrganizationId: withheld ? acting.organizationId : null,
    };
  }
  // #endregion
}
