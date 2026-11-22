import type { FactoryProvider } from '@nestjs/common';

import { FindAuthoritativeMembership } from '../../../../../memberships/public/membership/find-authoritative-membership.js';
import type { RealtimeTicketAccessPort } from '../../../../application/ports/outbound/memberships/realtime-ticket/realtime-ticket-access.port.js';
import type { SessionTokens } from '../../../../application/ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import type { RealtimeTicketUnitOfWork } from '../../../../application/ports/outbound/transactions/realtime-ticket/realtime-ticket-unit-of-work.port.js';
import { RedeemRealtimeTicket } from '../../../../application/use-cases/commands/realtime-ticket/redeem-realtime-ticket/redeem-realtime-ticket.use-case.js';
import { REALTIME_TICKET_ACCESS } from '../../../tokens/realtime-ticket/realtime-ticket-access.token.js';
import { REALTIME_TICKET_UNIT_OF_WORK } from '../../../tokens/realtime-ticket/realtime-ticket-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { SESSION_TOKENS } from '../../../tokens/session/session-tokens.token.js';

/** Provides realtime ticket redemption to Sessions adapters. */
export const redeemRealtimeTicketProvider: FactoryProvider<RedeemRealtimeTicket> = {
  provide: RedeemRealtimeTicket,
  inject: [
    REALTIME_TICKET_UNIT_OF_WORK,
    REALTIME_TICKET_ACCESS,
    SESSION_TOKENS,
    CLOCK,
    FindAuthoritativeMembership,
  ],
  useFactory: (
    unitOfWork: RealtimeTicketUnitOfWork,
    access: RealtimeTicketAccessPort,
    tokens: SessionTokens,
    clock: Clock,
    authority: FindAuthoritativeMembership | null,
  ): RedeemRealtimeTicket =>
    new RedeemRealtimeTicket(
      unitOfWork,
      access,
      tokens,
      clock,
      authority === null
        ? null
        : { find: (organizationId, userId) => authority.execute({ organizationId, userId }) },
    ),
};
