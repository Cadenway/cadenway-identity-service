import { JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import type { FactoryProvider } from '@nestjs/common';

import {
  FEDERATION_EXPIRY_CRON,
  FEDERATION_EXPIRY_QUEUE,
} from '../../../../../../config/job-queues.js';
import { PurgeExpiredFederation } from '../../../../application/use-cases/commands/federated-sign-in/purge-expired-federation/purge-expired-federation.use-case.js';
import { FederationExpirySweepHandler } from '../../../../presentation/jobs/handlers/federated-sign-in/federation-expiry-sweep.handler.js';

/** Registers federation retention on its provisioned durable queue. */
export const federationExpirySweepHandlerProvider: FactoryProvider<FederationExpirySweepHandler> = {
  provide: FederationExpirySweepHandler,
  inject: [JobScheduler, JobWorkerRegistry, PurgeExpiredFederation],
  useFactory: (
    scheduler: JobScheduler,
    workers: JobWorkerRegistry,
    purge: PurgeExpiredFederation,
  ): FederationExpirySweepHandler =>
    new FederationExpirySweepHandler(
      scheduler,
      workers,
      purge,
      FEDERATION_EXPIRY_QUEUE,
      FEDERATION_EXPIRY_CRON,
    ),
};
