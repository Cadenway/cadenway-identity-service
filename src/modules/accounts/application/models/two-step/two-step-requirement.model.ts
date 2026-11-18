/**
 * Interface TwoStepRequirement
 *
 * @description
 * An organization whose authentication policy requires two-step verification for the role of the
 * person (`TwoStepRequirement` of the contract).
 */
export interface TwoStepRequirement {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property requiredFor
   *
   * @description
   * The role group its policy requires it of.
   *
   * @type {'admins' | 'everyone'}
   * @readonly
   */
  readonly requiredFor: 'admins' | 'everyone';
  // #endregion
}
