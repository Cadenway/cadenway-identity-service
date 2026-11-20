import { JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import type { FactoryProvider } from '@nestjs/common';

import {
  REALTIME_TICKET_EXPIRY_CRON,
  REALTIME_TICKET_EXPIRY_QUEUE,
} from '../../../../../../config/job-queues.js';
import { PurgeExpiredRealtimeTickets } from '../../../../application/use-cases/commands/realtime-ticket/purge-expired-realtime-tickets/purge-expired-realtime-tickets.use-case.js';
import { RealtimeTicketExpiryHandler } from '../../../../presentation/jobs/handlers/realtime-ticket/realtime-ticket-expiry.handler.js';

/** Registers the ticket expiration handler on the declared durable queue. */
export const realtimeTicketExpiryHandlerProvider: FactoryProvider<RealtimeTicketExpiryHandler> = {
  provide: RealtimeTicketExpiryHandler,
  inject: [JobScheduler, JobWorkerRegistry, PurgeExpiredRealtimeTickets],
  useFactory: (
    scheduler: JobScheduler,
    workers: JobWorkerRegistry,
    purge: PurgeExpiredRealtimeTickets,
  ): RealtimeTicketExpiryHandler =>
    new RealtimeTicketExpiryHandler(
      scheduler,
      workers,
      purge,
      REALTIME_TICKET_EXPIRY_QUEUE,
      REALTIME_TICKET_EXPIRY_CRON,
    ),
};
