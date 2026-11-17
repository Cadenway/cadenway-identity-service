/**
 * Interface CompleteAccountDeletionOutput
 *
 * @description
 * What a deletion job did: `deleted`, `kept` (the account owned an organization at `deleteAt`) or
 * `not-due` (the deletion was cancelled, is not due, or the account was deleted already).
 */
export interface CompleteAccountDeletionOutput {
  // #region Properties
  /**
   * Property outcome
   *
   * @description
   * The outcome of the job.
   *
   * @type {'deleted' | 'kept' | 'not-due'}
   * @readonly
   */
  readonly outcome: 'deleted' | 'kept' | 'not-due';
  // #endregion
}
