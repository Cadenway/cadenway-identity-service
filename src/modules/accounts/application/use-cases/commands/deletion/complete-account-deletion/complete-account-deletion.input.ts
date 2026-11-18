/**
 * Interface CompleteAccountDeletionInput
 *
 * @description
 * The account a deletion job completes.
 */
export interface CompleteAccountDeletionInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account whose deletion is due.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}
