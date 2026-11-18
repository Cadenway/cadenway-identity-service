/**
 * Interface FindTwoStepRequirementsOutput
 *
 * @description
 * The organizations of the copy of the memberships whose policy requires two-step verification for
 * the role of the account in them (`requiredBy` of `TwoStepVerification`), ordered by organization.
 */
export interface FindTwoStepRequirementsOutput {
  // #region Properties
  /**
   * Property requirements
   *
   * @description
   * Each organization and the role group its policy requires it of.
   *
   * @type {readonly { readonly organizationId: string; readonly requiredFor: 'admins' | 'everyone' }[]}
   * @readonly
   */
  readonly requirements: readonly {
    readonly organizationId: string;
    readonly requiredFor: 'admins' | 'everyone';
  }[];
  // #endregion
}
