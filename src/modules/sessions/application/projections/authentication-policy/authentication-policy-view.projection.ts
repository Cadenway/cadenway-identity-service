/**
 * Interface AuthenticationPolicyView
 *
 * @description
 * The authentication policy of an organization as its routes answer it (`AuthenticationPolicy` of
 * the contract), with the counts of its members without two-step verification.
 */
export interface AuthenticationPolicyView {
  // #region Properties
  /**
   * Property twoStepVerificationRequiredFor
   *
   * @description
   * Who must have two-step verification.
   *
   * @type {'nobody' | 'admins' | 'everyone'}
   * @readonly
   */
  readonly twoStepVerificationRequiredFor: 'nobody' | 'admins' | 'everyone';

  /**
   * Property sessionInactivityTimeoutMinutes
   *
   * @description
   * The inactivity of the sessions, in minutes.
   *
   * @type {number}
   * @readonly
   */
  readonly sessionInactivityTimeoutMinutes: number;

  /**
   * Property adminsWithoutTwoStepVerification
   *
   * @description
   * The owner and the admins whose account has no two-step verification.
   *
   * @type {number}
   * @readonly
   */
  readonly adminsWithoutTwoStepVerification: number;

  /**
   * Property membersWithoutTwoStepVerification
   *
   * @description
   * Every member, guests included, whose account has no two-step verification.
   *
   * @type {number}
   * @readonly
   */
  readonly membersWithoutTwoStepVerification: number;

  /**
   * Property version
   *
   * @description
   * Version of the policy, its `ETag`.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
