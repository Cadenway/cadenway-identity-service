/**
 * Interface EnqueueDueAccountDeletionsOutput
 *
 * @description
 * What one sweep of the due deletions did.
 */
export interface EnqueueDueAccountDeletionsOutput {
  // #region Properties
  /**
   * Property claimed
   *
   * @description
   * Due accounts the sweep claimed.
   *
   * @type {number}
   * @readonly
   */
  readonly claimed: number;

  /**
   * Property enqueued
   *
   * @description
   * Deletion jobs it enqueued; the others were enqueued by an earlier sweep.
   *
   * @type {number}
   * @readonly
   */
  readonly enqueued: number;
  // #endregion
}
