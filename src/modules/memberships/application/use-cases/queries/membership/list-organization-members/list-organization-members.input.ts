/**
 * Interface ListOrganizationMembersInput
 *
 * @description
 * Which organization: the one of the tenant transaction.
 */
export interface ListOrganizationMembersInput {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization of the tenant transaction.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;
  // #endregion
}
