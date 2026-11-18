import type { TransactionScope } from '@cadenway/nest-common/database';
import type { JobEnqueueResult, JobProducer } from '@cadenway/nest-jobs/runtime';

import { ACCOUNT_DELETION_QUEUE } from '../../../../../../config/job-queues.js';
import type { AccountDeletionQueue } from '../../../../application/ports/outbound/jobs/accounts/account-deletion-queue.port.js';

/**
 * Class JobsAccountDeletionQueue
 *
 * @description
 * `AccountDeletionQueue` on the `account.delete` queue of `@cadenway/nest-jobs`, bound to the
 * transaction of a unit of work: the job row is inserted through the connection of that
 * transaction, so it exists if and only if the transaction commits. The payload holds the id of the
 * account only; the occurrence key is that id and the occurrence, so a doubled sweep enqueues
 * nothing more.
 */
export class JobsAccountDeletionQueue implements AccountDeletionQueue {
  // #region Properties
  /**
   * Property transaction
   *
   * @description
   * The transaction of the unit of work.
   *
   * @type {TransactionScope}
   * @readonly
   */
  private readonly transaction: TransactionScope;

  /**
   * Property jobs
   *
   * @description
   * The producer of `@cadenway/nest-jobs`.
   *
   * @type {JobProducer}
   * @readonly
   */
  private readonly jobs: JobProducer;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the queue to a transaction.
   *
   * @param {TransactionScope} transaction - The transaction of the unit of work.
   * @param {JobProducer} jobs - The producer of `@cadenway/nest-jobs`.
   * @constructor
   */
  public constructor(transaction: TransactionScope, jobs: JobProducer) {
    this.transaction = transaction;
    this.jobs = jobs;
  }
  // #endregion

  // #region Methods
  /**
   * Method enqueue
   *
   * @description
   * Enqueues the deletion of an account once per occurrence.
   *
   * @param {string} userId - The account.
   * @param {string} occurrence - What distinguishes this attempt.
   * @returns {Promise<boolean>} `true` when a job was inserted, `false` for a duplicate.
   */
  public async enqueue(userId: string, occurrence: string): Promise<boolean> {
    const result: JobEnqueueResult = await this.jobs.enqueue(
      this.transaction,
      ACCOUNT_DELETION_QUEUE,
      { userId },
      { occurrenceKey: `${userId}:${occurrence}` },
    );
    return !result.duplicate;
  }
  // #endregion
}
