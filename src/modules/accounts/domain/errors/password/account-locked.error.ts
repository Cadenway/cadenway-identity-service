import { DomainError } from '../accounts/domain.error.js';

/**
 * Class AccountLockedError
 *
 * @description
 * A password sign-in of an address whose lockout has not ended, whatever the password.
 */
export class AccountLockedError extends DomainError {
  // #region Properties
  /**
   * Property lockedUntil
   *
   * @description
   * When the password sign-in of the address is accepted again.
   *
   * @type {Date}
   * @readonly
   */
  public readonly lockedUntil: Date;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the sign-in until `lockedUntil`.
   *
   * @param {Date} lockedUntil - When the lockout ends.
   * @constructor
   */
  public constructor(lockedUntil: Date) {
    super('The password sign-in of this address is locked.');
    this.lockedUntil = lockedUntil;
  }
  // #endregion
}
