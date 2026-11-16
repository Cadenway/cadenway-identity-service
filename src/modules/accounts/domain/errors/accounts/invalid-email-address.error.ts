import { DomainError } from './domain.error.js';

/**
 * Class InvalidEmailAddressError
 *
 * @description
 * An address that is empty, longer than 254 characters or without `@` once trimmed. The contract
 * validates the format first, so this only guards the domain against a caller that skipped it.
 */
export class InvalidEmailAddressError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the address without quoting it: an address is personal data.
   *
   * @constructor
   */
  public constructor() {
    super('The email address is not a valid address.');
  }
  // #endregion
}
