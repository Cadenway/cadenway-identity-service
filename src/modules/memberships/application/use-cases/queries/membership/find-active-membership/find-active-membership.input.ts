/**
 * Interface FindActiveMembershipInput
 *
 * @description
 * Whose membership in which organization: both come from a verified source (the internal token, a
 * stored session or a stored API token), never from a request body alone.
 */
export interface FindActiveMembershipInput {
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
