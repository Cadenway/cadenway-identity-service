import { JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import type { FactoryProvider } from '@nestjs/common';

import { ACCOUNT_DELETION_QUEUE } from '../../../../../../config/job-queues.js';
import { CompleteAccountDeletion } from '../../../../application/use-cases/commands/deletion/complete-account-deletion/complete-account-deletion.use-case.js';
import { CompleteAccountDeletionHandler } from '../../../../presentation/jobs/handlers/account-deletion/complete-account-deletion.handler.js';

/**
 * Constant completeAccountDeletionHandlerProvider
 *
 * @description
 * Builds the worker of the deletion jobs on its queue of `src/config/job-queues.ts`.
 *
 * @type {FactoryProvider<CompleteAccountDeletionHandler>}
 */
export const completeAccountDeletionHandlerProvider: FactoryProvider<CompleteAccountDeletionHandler> =
  {
    provide: CompleteAccountDeletionHandler,
    inject: [JobWorkerRegistry, CompleteAccountDeletion],
    useFactory: (
      workers: JobWorkerRegistry,
      useCase: CompleteAccountDeletion,
    ): CompleteAccountDeletionHandler =>
      new CompleteAccountDeletionHandler(workers, useCase, ACCOUNT_DELETION_QUEUE),
  };
