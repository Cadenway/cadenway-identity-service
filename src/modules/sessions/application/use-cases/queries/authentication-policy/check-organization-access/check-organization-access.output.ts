/**
 * Interface CheckOrganizationAccessOutput
 *
 * @description
 * Whether the organization gives the member a context.
 */
export interface CheckOrganizationAccessOutput {
  // #region Properties
  /**
   * Property withheld
   *
   * @description
   * `true` when its policy requires two-step verification for the role of the member, whose account
   * has none.
   *
   * @type {boolean}
   * @readonly
   */
  readonly withheld: boolean;
  // #endregion
}
