import type { TwoStepRequiredFor } from './two-step-required-for.value-object.js';

/**
 * Interface AuthenticationPolicyPatch
 *
 * @description
 * A JSON Merge Patch of an authentication policy: a member left out is unchanged
 * (`AuthenticationPolicyPatch` of the contract).
 */
export interface AuthenticationPolicyPatch {
  // #region Properties
  /**
   * Property twoStepVerificationRequiredFor
   *
   * @description
   * The new roles that must have two-step verification, when the patch sets them.
   *
   * @type {TwoStepRequiredFor | undefined}
   * @readonly
   */
  readonly twoStepVerificationRequiredFor?: TwoStepRequiredFor;

  /**
   * Property sessionInactivityTimeoutMinutes
   *
   * @description
   * The new inactivity of the sessions, in minutes, when the patch sets it.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly sessionInactivityTimeoutMinutes?: number;
  // #endregion
}
