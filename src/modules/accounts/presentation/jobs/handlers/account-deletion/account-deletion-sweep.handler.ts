import type { JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import { Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';

import type { EnqueueDueAccountDeletionsOutput } from '../../../../application/use-cases/commands/deletion/enqueue-due-account-deletions/enqueue-due-account-deletions.output.js';
import type { EnqueueDueAccountDeletions } from '../../../../application/use-cases/commands/deletion/enqueue-due-account-deletions/enqueue-due-account-deletions.use-case.js';

/**
 * Class AccountDeletionSweepHandler
 *
 * @description
 * The recurring sweep of the scheduled deletions: at start-up every replica registers the same
 * durable schedule (one job per occurrence whatever the number of replicas, evaluated in UTC) and
 * the worker of its queue, whose jobs carry no payload and call `EnqueueDueAccountDeletions`. A
 * missed or doubled sweep changes nothing: the next one claims what is due, and an occurrence key
 * keeps a deletion from being enqueued twice.
 */
export class AccountDeletionSweepHandler implements OnApplicationBootstrap {
  // #region Properties
  /**
   * Property logger
   *
   * @description
   * Logs the counts of a sweep, never an account.
   *
   * @type {Logger}
   * @readonly
   */
  private readonly logger: Logger = new Logger(AccountDeletionSweepHandler.name);

  /**
   * Property scheduler
   *
   * @description
   * The durable schedules of `@cadenway/nest-jobs`.
   *
   * @type {JobScheduler}
   * @readonly
   */
  private readonly scheduler: JobScheduler;

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
   * Property enqueueDueAccountDeletions
   *
   * @description
   * Use case of the sweep.
   *
   * @type {EnqueueDueAccountDeletions}
   * @readonly
   */
  private readonly enqueueDueAccountDeletions: EnqueueDueAccountDeletions;

  /**
   * Property queueName
   *
   * @description
   * Queue of the sweep.
   *
   * @type {string}
   * @readonly
   */
  private readonly queueName: string;

  /**
   * Property cron
   *
   * @description
   * When the sweep runs, in UTC.
   *
   * @type {string}
   * @readonly
   */
  private readonly cron: string;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the jobs runtime, the use case and the queue with its schedule.
   *
   * @param {JobScheduler} scheduler - The durable schedules.
   * @param {JobWorkerRegistry} workers - The workers.
   * @param {EnqueueDueAccountDeletions} enqueueDueAccountDeletions - Use case of the sweep.
   * @param {string} queueName - Queue of the sweep.
   * @param {string} cron - When the sweep runs, in UTC.
   * @constructor
   */
  public constructor(
    scheduler: JobScheduler,
    workers: JobWorkerRegistry,
    enqueueDueAccountDeletions: EnqueueDueAccountDeletions,
    queueName: string,
    cron: string,
  ) {
    this.scheduler = scheduler;
    this.workers = workers;
    this.enqueueDueAccountDeletions = enqueueDueAccountDeletions;
    this.queueName = queueName;
    this.cron = cron;
  }
  // #endregion

  // #region Methods
  /**
   * Method onApplicationBootstrap
   *
   * @description
   * Registers the schedule and the worker of the sweep.
   *
   * @returns {Promise<void>} Resolves once both are registered.
   */
  public async onApplicationBootstrap(): Promise<void> {
    await this.scheduler.schedule(this.queueName, this.cron, { timeZone: 'UTC' });
    await this.workers.work(this.queueName, (): Promise<void> => this.handle());
  }

  /**
   * Method handle
   *
   * @description
   * Runs one sweep; a failure rejects the job, which its queue retries.
   *
   * @returns {Promise<void>} Resolves once the due deletions are enqueued.
   */
  public async handle(): Promise<void> {
    const result: EnqueueDueAccountDeletionsOutput =
      await this.enqueueDueAccountDeletions.execute();
    if (result.claimed > 0) {
      this.logger.log(
        { claimed: result.claimed, enqueued: result.enqueued },
        'due account deletions enqueued',
      );
    }
  }
  // #endregion
}
