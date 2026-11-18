import type { TwoStepRequiredFor } from './two-step-required-for.value-object.js';

/**
 * Interface AuthenticationPolicyState
 *
 * @description
 * The stored authentication policy of an organization (`authentication_policies`).
 */
export interface AuthenticationPolicyState {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization of the policy.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property twoStepVerificationRequiredFor
   *
   * @description
   * The roles that must have two-step verification.
   *
   * @type {TwoStepRequiredFor}
   * @readonly
   */
  readonly twoStepVerificationRequiredFor: TwoStepRequiredFor;

  /**
   * Property sessionInactivityTimeoutMinutes
   *
   * @description
   * Minutes of inactivity after which a session acting on the organization closes.
   *
   * @type {number}
   * @readonly
   */
  readonly sessionInactivityTimeoutMinutes: number;

  /**
   * Property version
   *
   * @description
   * Version of the policy, its `ETag`; 1 for the default policy.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
