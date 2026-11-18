/**
 * Interface RevokeOtherSessionsOutput
 *
 * @description
 * How many sessions "Déconnecter les autres" closed ("2 sessions fermées").
 */
export interface RevokeOtherSessionsOutput {
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
