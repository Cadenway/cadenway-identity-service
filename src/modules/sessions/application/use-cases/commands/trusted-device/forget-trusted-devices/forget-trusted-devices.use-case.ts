import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { ForgetTrustedDevicesInput } from './forget-trusted-devices.input.js';

/**
 * Class ForgetTrustedDevices
 *
 * @description
 * Forgets every trusted device of an account ("Trusted devices" of the internal contract): a
 * password change or reset, turning two-step verification off and the scheduling of the deletion
 * call it; the revocation of the other sessions does the same in this module. Joins the system
 * transaction of its caller.
 */
export class ForgetTrustedDevices {
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
   * Takes its ports, bound by the composition of the module.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction, joined to the one of the caller.
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
   * Deletes the trusted devices of the account.
   *
   * @param {ForgetTrustedDevicesInput} input - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async execute(input: ForgetTrustedDevicesInput): Promise<void> {
    await this.unitOfWork.run(async (store: SessionsStore): Promise<void> => {
      await store.trustedDevices.deleteOfUser(input.userId);
    });
  }
  // #endregion
}
