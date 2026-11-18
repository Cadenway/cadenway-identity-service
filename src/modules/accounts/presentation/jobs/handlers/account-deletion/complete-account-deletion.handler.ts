import type { Job, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import { Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { z } from 'zod';

import type { CompleteAccountDeletionOutput } from '../../../../application/use-cases/commands/deletion/complete-account-deletion/complete-account-deletion.output.js';
import type { CompleteAccountDeletion } from '../../../../application/use-cases/commands/deletion/complete-account-deletion/complete-account-deletion.use-case.js';

/**
 * Constant jobPayloadSchema
 *
 * @description
 * The payload of a deletion job: the id of the account, nothing else.
 *
 * @type {z.ZodType<{ readonly userId: string }>}
 */
const jobPayloadSchema: z.ZodType<{ readonly userId: string }> = z.object({ userId: z.uuid() });

/**
 * Class CompleteAccountDeletionHandler
 *
 * @description
 * The worker of the deletion jobs: each job calls `CompleteAccountDeletion` for one account, which
 * is idempotent (a job run twice, or after a cancellation, does nothing). A rejected attempt is
 * retried by the queue, then becomes a dead letter of `account.delete.dead-letter`; the job id and
 * the account id are logged, never an address.
 */
export class CompleteAccountDeletionHandler implements OnApplicationBootstrap {
  // #region Properties
  /**
   * Property logger
   *
   * @description
   * Logs the outcome of a job with the ids only.
   *
   * @type {Logger}
   * @readonly
   */
  private readonly logger: Logger = new Logger(CompleteAccountDeletionHandler.name);

  /**
   * Property workers
   *
   * @description
   * The workers of `@cadenway/nest-jobs`.
   *
   * @type {JobWorkerRegistry}
   * @readonly
   */
  private readonly workers: JobWorkerRegistry;

  /**
   * Property completeAccountDeletion
   *
   * @description
   * Use case of the deletion.
   *
   * @type {CompleteAccountDeletion}
   * @readonly
   */
  private readonly completeAccountDeletion: CompleteAccountDeletion;

  /**
   * Property queueName
   *
   * @description
   * Queue of the deletion jobs.
   *
   * @type {string}
   * @readonly
   */
  private readonly queueName: string;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the workers, the use case and the queue.
   *
   * @param {JobWorkerRegistry} workers - The workers.
   * @param {CompleteAccountDeletion} completeAccountDeletion - Use case of the deletion.
   * @param {string} queueName - Queue of the deletion jobs.
   * @constructor
   */
  public constructor(
    workers: JobWorkerRegistry,
    completeAccountDeletion: CompleteAccountDeletion,
    queueName: string,
  ) {
    this.workers = workers;
    this.completeAccountDeletion = completeAccountDeletion;
    this.queueName = queueName;
  }
  // #endregion

  // #region Methods
  /**
   * Method onApplicationBootstrap
   *
   * @description
   * Registers the worker of the queue.
   *
   * @returns {Promise<void>} Resolves once registered.
   */
  public async onApplicationBootstrap(): Promise<void> {
    await this.workers.work(this.queueName, (job: Job): Promise<void> => this.handle(job));
  }

  /**
   * Method handle
   *
   * @description
   * Completes the deletion of the account of a job.
   *
   * @param {Job} job - The job.
   * @returns {Promise<void>} Resolves once handled.
   * @throws {z.ZodError} When the payload is not a deletion job: the job ends as a dead letter.
   */
  public async handle(job: Job): Promise<void> {
    const { userId }: { readonly userId: string } = jobPayloadSchema.parse(job.payload);
    const result: CompleteAccountDeletionOutput = await this.completeAccountDeletion.execute({
      userId,
    });
    this.logger.log(
      { userId, jobId: job.id, attempt: job.attempt, outcome: result.outcome },
      'account deletion job handled',
    );
  }
  // #endregion
}
