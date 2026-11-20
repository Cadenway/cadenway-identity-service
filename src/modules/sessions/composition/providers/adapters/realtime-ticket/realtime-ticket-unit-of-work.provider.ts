import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import type { FactoryProvider } from '@nestjs/common';

import type { RealtimeTicketUnitOfWork } from '../../../../application/ports/outbound/transactions/realtime-ticket/realtime-ticket-unit-of-work.port.js';
import { SystemRealtimeTicketsUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/session/system-realtime-tickets.unit-of-work.js';
import { REALTIME_TICKET_UNIT_OF_WORK } from '../../../tokens/realtime-ticket/realtime-ticket-unit-of-work.token.js';

/** Provides the system transaction shared by ticket state, session state and authorization. */
export const realtimeTicketUnitOfWorkProvider: FactoryProvider<RealtimeTicketUnitOfWork> = {
  provide: REALTIME_TICKET_UNIT_OF_WORK,
  inject: [SystemTransactionRunner],
  useFactory: (runner: SystemTransactionRunner): RealtimeTicketUnitOfWork =>
    new SystemRealtimeTicketsUnitOfWork(runner),
};
