/**
 * Interface RevokeUserSessionsOutput
 *
 * @description
 * How many sessions a revocation closed.
 */
export interface RevokeUserSessionsOutput {
  // #region Properties
  /**
   * Property revokedCount
   *
   * @description
   * The revoked sessions.
   *
   * @type {number}
   * @readonly
   */
  readonly revokedCount: number;
  // #endregion
}
