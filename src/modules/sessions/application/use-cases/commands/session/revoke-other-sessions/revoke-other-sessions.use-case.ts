import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import {
  lockOpenSessionOf,
  revokeOpenSessions,
} from '../../../../services/session/open-sessions.service.js';
import type { RevokeOtherSessionsInput } from './revoke-other-sessions.input.js';
import type { RevokeOtherSessionsOutput } from './revoke-other-sessions.output.js';

/**
 * Class RevokeOtherSessions
 *
 * @description
 * Revokes every open session of the actor except the one of the request ("Déconnecter les autres",
 * `POST /internal/v1/sessions/{sessionId}/revoke-others`), each with `session.revoked.v1`, and says
 * how many, and forgets every trusted device of the account, the one of the request included
 * (P2c-2). The personal API tokens stay. A session of another person, an unknown or an ended one
 * answers `session.not-found` and revokes nothing. One system transaction locks the session of the
 * request, then the others.
 */
export class RevokeOtherSessions {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property clock
   *
   * @description
   * The time of the revocation.
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
   * Takes the ports of the revocation.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction.
   * @param {Clock} clock - The time of the revocation.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Revokes the other sessions.
   *
   * @param {RevokeOtherSessionsInput} input - The person and the session that stays open.
   * @returns {Promise<RevokeOtherSessionsOutput>} How many were revoked.
   * @throws {SessionNotFound} When the session is not an open session of the person.
   */
  public async execute(input: RevokeOtherSessionsInput): Promise<RevokeOtherSessionsOutput> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: SessionsStore): Promise<RevokeOtherSessionsOutput> => {
      const current: Session | null = await lockOpenSessionOf(
        store,
        input.actorUserId,
        input.sessionId,
        now,
      );
      if (current === null) {
        throw new SessionNotFound();
      }
      const revokedCount: number = await revokeOpenSessions(
        store,
        input.actorUserId,
        current.id,
        now,
      );
      await store.trustedDevices.deleteOfUser(input.actorUserId);
      return { revokedCount };
    });
  }
  // #endregion
}
