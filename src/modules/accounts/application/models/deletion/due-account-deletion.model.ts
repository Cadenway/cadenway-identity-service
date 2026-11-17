/**
 * Interface DueAccountDeletion
 *
 * @description
 * An account whose scheduled deletion is due and not checked recently, claimed by the sweep of the
 * deletions.
 */
export interface DueAccountDeletion {
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

  /**
   * Property dueSince
   *
   * @description
   * The instant its deletion became due, or its last check that kept it: the occurrence of the job
   * that completes it, so that each check enqueues one job.
   *
   * @type {Date}
   * @readonly
   */
  readonly dueSince: Date;
  // #endregion
}
