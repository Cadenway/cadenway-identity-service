import { DomainError } from '../accounts/domain.error.js';

/**
 * Class InvalidTwoStepStateError
 *
 * @description
 * A stored or computed state of two-step verification that breaks one of its rules: a negative or
 * too large count of wrong answers, a time step accepted twice, a security key without a name.
 */
export class InvalidTwoStepStateError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the broken rule, without any value.
   *
   * @param {string} rule - The rule, in English.
   * @constructor
   */
  public constructor(rule: string) {
    super(`Invalid two-step verification: ${rule}.`);
  }
  // #endregion
}
