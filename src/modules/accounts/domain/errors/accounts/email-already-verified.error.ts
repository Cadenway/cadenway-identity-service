import { DomainError } from './domain.error.js';

/**
 * Class EmailAlreadyVerifiedError
 *
 * @description
 * A change that only an account whose address is not verified yet accepts: replacing the name and
 * password of a sign-up, or verifying the address.
 */
export class EmailAlreadyVerifiedError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the change of a verified account.
   *
   * @constructor
   */
  public constructor() {
    super('The address of this account is already verified.');
  }
  // #endregion
}
