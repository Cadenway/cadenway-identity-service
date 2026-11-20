import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import type { FactoryProvider } from '@nestjs/common';

import { LockActiveMembership } from '../../../../../memberships/public/membership/lock-active-membership.js';
import type { RealtimeTicketAccessPort } from '../../../../application/ports/outbound/memberships/realtime-ticket/realtime-ticket-access.port.js';
import { DrizzleRealtimeTicketAccessRepository } from '../../../../infrastructure/persistence/drizzle/repositories/session/drizzle-realtime-ticket-access.repository.js';
import { REALTIME_TICKET_ACCESS } from '../../../tokens/realtime-ticket/realtime-ticket-access.token.js';

/** Binds locked membership and policy reads to the caller's system transaction. */
export const realtimeTicketAccessProvider: FactoryProvider<RealtimeTicketAccessPort> = {
  provide: REALTIME_TICKET_ACCESS,
  inject: [SystemTransactionRunner, LockActiveMembership],
  useFactory: (
    runner: SystemTransactionRunner,
    memberships: LockActiveMembership,
  ): RealtimeTicketAccessPort => new DrizzleRealtimeTicketAccessRepository(runner, memberships),
};
