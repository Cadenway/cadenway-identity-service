import { DomainError } from '../accounts/domain.error.js';

/**
 * Class PasswordTooShortError
 *
 * @description
 * A password with fewer Unicode code points than the policy requires.
 */
export class PasswordTooShortError extends DomainError {
  // #region Properties
  /**
   * Property minLength
   *
   * @description
   * The minimum length of the policy, in code points, for `details.minLength`.
   *
   * @type {number}
   * @readonly
   */
  public readonly minLength: number;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the password without quoting it or its length.
   *
   * @param {number} minLength - The minimum length of the policy.
   * @constructor
   */
  public constructor(minLength: number) {
    super(`A password needs ${String(minLength)} characters at least.`);
    this.minLength = minLength;
  }
  // #endregion
}
