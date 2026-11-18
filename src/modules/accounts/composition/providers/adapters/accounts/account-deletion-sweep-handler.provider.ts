import { JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import type { FactoryProvider } from '@nestjs/common';

import {
  ACCOUNT_DELETION_SWEEP_CRON,
  ACCOUNT_DELETION_SWEEP_QUEUE,
} from '../../../../../../config/job-queues.js';
import { EnqueueDueAccountDeletions } from '../../../../application/use-cases/commands/deletion/enqueue-due-account-deletions/enqueue-due-account-deletions.use-case.js';
import { AccountDeletionSweepHandler } from '../../../../presentation/jobs/handlers/account-deletion/account-deletion-sweep.handler.js';

/**
 * Constant accountDeletionSweepHandlerProvider
 *
 * @description
 * Builds the sweep of the scheduled deletions on its queue and schedule of `src/config/job-queues.ts`.
 *
 * @type {FactoryProvider<AccountDeletionSweepHandler>}
 */
export const accountDeletionSweepHandlerProvider: FactoryProvider<AccountDeletionSweepHandler> = {
  provide: AccountDeletionSweepHandler,
  inject: [JobScheduler, JobWorkerRegistry, EnqueueDueAccountDeletions],
  useFactory: (
    scheduler: JobScheduler,
    workers: JobWorkerRegistry,
    useCase: EnqueueDueAccountDeletions,
  ): AccountDeletionSweepHandler =>
    new AccountDeletionSweepHandler(
      scheduler,
      workers,
      useCase,
      ACCOUNT_DELETION_SWEEP_QUEUE,
      ACCOUNT_DELETION_SWEEP_CRON,
    ),
};
