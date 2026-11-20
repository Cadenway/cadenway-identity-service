import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import { PurgeExpiredRealtimeTickets } from '../../../../application/use-cases/commands/realtime-ticket/purge-expired-realtime-tickets/purge-expired-realtime-tickets.use-case.js';
import { SystemExpiredRealtimeTicketsUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/session/system-expired-realtime-tickets.unit-of-work.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';

/** Builds the expiration sweep for the private Sessions worker. */
export const purgeExpiredRealtimeTicketsProvider: FactoryProvider<PurgeExpiredRealtimeTickets> = {
  provide: PurgeExpiredRealtimeTickets,
  inject: [SystemTransactionRunner, CLOCK],
  useFactory: (runner: SystemTransactionRunner, clock: Clock): PurgeExpiredRealtimeTickets =>
    new PurgeExpiredRealtimeTickets(new SystemExpiredRealtimeTicketsUnitOfWork(runner), clock),
};
