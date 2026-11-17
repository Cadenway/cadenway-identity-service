/**
 * Interface FindOwnedOrganizationsInput
 *
 * @description
 * Whose owned organizations: the verified actor, or the account a deletion job completes.
 */
export interface FindOwnedOrganizationsInput {
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
