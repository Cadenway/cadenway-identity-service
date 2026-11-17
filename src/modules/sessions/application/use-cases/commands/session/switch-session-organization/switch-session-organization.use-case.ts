import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type { ActiveMembership } from '../../../../models/session/active-membership.model.js';
import { OrganizationNotFound } from '../../../../models/session/organization-not-found.model.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { ActiveMemberships } from '../../../../ports/outbound/memberships/session/active-memberships.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { SwitchSessionOrganizationInput } from './switch-session-organization.input.js';
import type { SwitchSessionOrganizationOutput } from './switch-session-organization.output.js';

/**
 * Class SwitchSessionOrganization
 *
 * @description
 * Makes an organization the current organization of a session of the actor, and the one its next
 * sessions start in (`PUT /internal/v1/sessions/{sessionId}/organization`, P2b plan, decision 2).
 * In one system transaction it locks the session, checks the active membership of the actor in the
 * copy of the memberships, then writes the session and the last choice of the account.
 *
 * - A session of another user, an unknown id, or a session that ended since its introspection is
 *   refused alike (`session.not-found`, which the gateway answers `401 auth.session-expired`).
 * - An organization the actor does not belong to, or whose `member.joined.v1` has not reached this
 *   service yet, is refused (`organization.not-found`); the web application retries.
 * - Choosing the membership the session already acts through changes nothing and writes nothing.
 */
export class SwitchSessionOrganization {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the choice.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

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
   * The time of the choice.
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
   * Takes the ports of the choice.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The transaction of the choice.
   * @param {ActiveMemberships} memberships - The copy of the memberships.
   * @param {Clock} clock - The time of the choice.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, memberships: ActiveMemberships, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.memberships = memberships;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Chooses the organization.
   *
   * @param {SwitchSessionOrganizationInput} input - The actor, the session and the organization.
   * @returns {Promise<SwitchSessionOrganizationOutput>} The organization and the role of the actor.
   * @throws {SessionNotFound} When no active session with this id belongs to the actor.
   * @throws {OrganizationNotFound} When the actor is not a member of the organization.
   */
  public async execute(
    input: SwitchSessionOrganizationInput,
  ): Promise<SwitchSessionOrganizationOutput> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (store: SessionsStore): Promise<SwitchSessionOrganizationOutput> => {
        const session: Session | null = await store.sessions.findForUpdate(input.sessionId);
        if (session?.userId !== input.actorUserId || !session.isActiveAt(now)) {
          throw new SessionNotFound();
        }
        const membership: ActiveMembership | null = await this.memberships.find(
          input.organizationId,
          input.actorUserId,
        );
        if (membership === null) {
          throw new OrganizationNotFound();
        }
        const chosen: Session = session.chooseOrganization(membership, now);
        if (chosen !== session) {
          await store.sessions.chooseOrganization(chosen);
          await store.organizationChoices.remember(input.actorUserId, membership.organizationId);
        }
        return { organizationId: membership.organizationId, role: membership.role };
      },
    );
  }
  // #endregion
}
