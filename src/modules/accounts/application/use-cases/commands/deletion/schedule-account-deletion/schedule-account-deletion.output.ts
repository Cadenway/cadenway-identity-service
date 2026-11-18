/**
 * Interface ScheduleAccountDeletionOutput
 *
 * @description
 * When the scheduled deletion takes effect.
 */
export interface ScheduleAccountDeletionOutput {
  // #region Properties
  /**
   * Property deleteAt
   *
   * @description
   * 30 days after the scheduling.
   *
   * @type {Date}
   * @readonly
   */
  readonly deleteAt: Date;
  // #endregion
}
