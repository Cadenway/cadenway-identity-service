/**
 * Interface FindUserMembershipsInput
 *
 * @description
 * Whose memberships: an account a verified source names (the actor of the internal token).
 */
export interface FindUserMembershipsInput {
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
