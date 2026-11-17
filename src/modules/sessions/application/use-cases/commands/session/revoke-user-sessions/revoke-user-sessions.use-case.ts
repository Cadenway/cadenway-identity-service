import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { revokeOpenSessions } from '../../../../services/session/open-sessions.service.js';
import type { RevokeUserSessionsInput } from './revoke-user-sessions.input.js';
import type { RevokeUserSessionsOutput } from './revoke-user-sessions.output.js';

/**
 * Class RevokeUserSessions
 *
 * @description
 * Revokes the open sessions of a person, but one, each with `session.revoked.v1`: a password reset
 * with "Fermer mes autres sessions" and the scheduling of the deletion of the account. Runs in the
 * system transaction of the accounts module and joins it.
 */
export class RevokeUserSessions {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction, joined to the one of the caller.
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
   * Revokes the sessions.
   *
   * @param {RevokeUserSessionsInput} input - The person and the session that stays open.
   * @returns {Promise<RevokeUserSessionsOutput>} How many were revoked.
   */
  public async execute(input: RevokeUserSessionsInput): Promise<RevokeUserSessionsOutput> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: SessionsStore): Promise<RevokeUserSessionsOutput> => ({
      revokedCount: await revokeOpenSessions(store, input.userId, input.exceptSessionId, now),
    }));
  }
  // #endregion
}
