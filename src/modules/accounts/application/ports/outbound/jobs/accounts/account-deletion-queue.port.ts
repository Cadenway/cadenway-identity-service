/**
 * Interface AccountDeletionQueue
 *
 * @description
 * The durable jobs that complete the scheduled deletion of an account, enqueued in the transaction
 * of the use case: the job exists if and only if the transaction commits.
 */
export interface AccountDeletionQueue {
  // #region Methods
  /**
   * Method enqueue
   *
   * @description
   * Enqueues the deletion of an account once per occurrence: enqueuing the same occurrence again
   * while its first job is kept does nothing.
   *
   * @param {string} userId - The account.
   * @param {string} occurrence - What distinguishes this attempt from a later one of the same
   * account (the instant it became due, or of its last check).
   * @returns {Promise<boolean>} `true` when a job was enqueued, `false` for a duplicate.
   */
  enqueue(userId: string, occurrence: string): Promise<boolean>;
  // #endregion
}
