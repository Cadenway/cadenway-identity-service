import { CONFIG } from '@cadenway/nest-common';
import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import {
  AUTHENTICATION_COUNTER_SWEEP_CRON,
  AUTHENTICATION_COUNTER_SWEEP_QUEUE,
} from '../../../../../../config/job-queues.js';
import { PurgeInactiveAuthenticationCounters } from '../../../../application/use-cases/commands/authentication/purge-inactive-authentication-counters/purge-inactive-authentication-counters.use-case.js';
import { SystemInactiveAuthenticationCountersUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/accounts/system-inactive-authentication-counters.unit-of-work.js';
import { AuthenticationCounterSweepHandler } from '../../../../presentation/jobs/handlers/authentication/authentication-counter-sweep.handler.js';

/** Registers authentication counter retention on the system database and durable job queue. */
export const authenticationCounterSweepProvider: FactoryProvider<AuthenticationCounterSweepHandler> =
  {
    provide: AuthenticationCounterSweepHandler,
    inject: [JobScheduler, JobWorkerRegistry, SystemTransactionRunner, CONFIG],
    useFactory: (
      scheduler: JobScheduler,
      workers: JobWorkerRegistry,
      runner: SystemTransactionRunner,
      config: Readonly<AppConfig>,
    ): AuthenticationCounterSweepHandler =>
      new AuthenticationCounterSweepHandler(
        scheduler,
        workers,
        new PurgeInactiveAuthenticationCounters(
          new SystemInactiveAuthenticationCountersUnitOfWork(runner),
        ),
        AUTHENTICATION_COUNTER_SWEEP_QUEUE,
        AUTHENTICATION_COUNTER_SWEEP_CRON,
        config.AUTHENTICATION_COUNTER_RETENTION_ENABLED,
      ),
  };
