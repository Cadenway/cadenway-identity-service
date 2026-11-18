/**
 * Interface RevokeUserApiTokensInput
 *
 * @description
 * The person whose personal API tokens the scheduling of the deletion of the account revokes.
 */
export interface RevokeUserApiTokensInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The person.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}
