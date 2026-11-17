/**
 * Interface RevokeUserApiTokensOutput
 *
 * @description
 * How many tokens the revocation closed.
 */
export interface RevokeUserApiTokensOutput {
  // #region Properties
  /**
   * Property revokedCount
   *
   * @description
   * The tokens revoked, in every organization.
   *
   * @type {number}
   * @readonly
   */
  readonly revokedCount: number;
  // #endregion
}
