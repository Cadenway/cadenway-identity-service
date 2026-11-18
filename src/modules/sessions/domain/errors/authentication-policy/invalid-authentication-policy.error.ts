import { DomainError } from '../session/domain.error.js';

/**
 * Class InvalidAuthenticationPolicyError
 *
 * @description
 * A policy outside the values of the contract: a role group or an inactivity it does not list, or
 * a version that is not a positive integer.
 */
export class InvalidAuthenticationPolicyError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the broken rule, without a value.
   *
   * @param {string} rule - The rule.
   * @constructor
   */
  public constructor(rule: string) {
    super(`Invalid authentication policy: ${rule}.`);
    this.name = 'InvalidAuthenticationPolicyError';
  }
  // #endregion
}
