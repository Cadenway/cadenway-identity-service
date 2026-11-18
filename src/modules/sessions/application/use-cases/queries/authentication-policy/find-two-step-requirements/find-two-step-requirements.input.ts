/**
 * Interface FindTwoStepRequirementsInput
 *
 * @description
 * The account whose organizations are read for the policies that require two-step verification of
 * it.
 */
export interface FindTwoStepRequirementsInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}
