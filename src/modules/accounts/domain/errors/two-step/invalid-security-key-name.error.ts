import { DomainError } from '../accounts/domain.error.js';

/**
 * Class InvalidSecurityKeyNameError
 *
 * @description
 * The name of a security key is empty once trimmed or longer than 60 characters
 * (`SecurityKeyAddition.name` of the contract, "Trimmed here").
 */
export class InvalidSecurityKeyNameError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the name.
   *
   * @constructor
   */
  public constructor() {
    super('The name of a security key has 1 to 60 characters.');
  }
  // #endregion
}
