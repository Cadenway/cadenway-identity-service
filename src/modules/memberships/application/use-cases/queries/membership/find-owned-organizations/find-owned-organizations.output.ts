/**
 * Interface FindOwnedOrganizationsOutput
 *
 * @description
 * The organizations an account owns in the copy of the memberships.
 */
export interface FindOwnedOrganizationsOutput {
  // #region Properties
  /**
   * Property organizationIds
   *
   * @description
   * The organizations whose active membership of the account has the role `owner`, empty when it
   * owns none.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly organizationIds: readonly string[];
  // #endregion
}
