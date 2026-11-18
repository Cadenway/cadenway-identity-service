/**
 * Interface FindOrganizationMemberInput
 *
 * @description
 * Which account in which organization: the organization of the tenant transaction and the actor of
 * the internal token.
 */
export interface FindOrganizationMemberInput {
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
