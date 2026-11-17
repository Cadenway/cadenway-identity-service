/**
 * Interface CountOpenSessionsOutput
 *
 * @description
 * The open sessions of an account.
 */
export interface CountOpenSessionsOutput {
  // #region Properties
  /**
   * Property count
   *
   * @description
   * Sessions neither revoked, expired nor idle for 12 hours.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;
  // #endregion
}
