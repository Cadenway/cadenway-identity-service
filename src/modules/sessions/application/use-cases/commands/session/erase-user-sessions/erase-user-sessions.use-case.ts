import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { EraseUserSessionsInput } from './erase-user-sessions.input.js';

/**
 * Class EraseUserSessions
 *
 * @description
 * Deletes every session of a deleted account, with the address and the `User-Agent` of its
 * browser, the last organization the account chose, its trusted devices and its two-step
 * enrollment (`user.deleted.v1`, decision 9 of P2c; P2c-2).
 * The sessions were revoked when the deletion was scheduled, so nothing is revoked here and no
 * event is emitted. Runs in the system transaction of the deletion and joins it.
 */
export class EraseUserSessions {
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
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the transaction.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Erases the sessions and the last choice of the account.
   *
   * @param {EraseUserSessionsInput} input - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async execute(input: EraseUserSessionsInput): Promise<void> {
    await this.unitOfWork.run(async (store: SessionsStore): Promise<void> => {
      await store.sessions.eraseOfUser(input.userId);
      await store.organizationChoices.erase(input.userId);
      await store.trustedDevices.deleteOfUser(input.userId);
      await store.enrollments.unenroll(input.userId);
    });
  }
  // #endregion
}
