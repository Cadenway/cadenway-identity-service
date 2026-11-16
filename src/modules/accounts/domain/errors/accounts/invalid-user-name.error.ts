import { DomainError } from './domain.error.js';

/**
 * Class InvalidUserNameError
 *
 * @description
 * A full name that is empty once its surrounding spaces are removed, or longer than 120 characters.
 */
export class InvalidUserNameError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the name without quoting it.
   *
   * @constructor
   */
  public constructor() {
    super('The name must have 1 to 120 characters once trimmed.');
  }
  // #endregion
}
