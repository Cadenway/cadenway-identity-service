import type { FactoryProvider } from '@nestjs/common';

import type { RealtimeTicketAccessPort } from '../../../../application/ports/outbound/memberships/realtime-ticket/realtime-ticket-access.port.js';
import type { SessionTokens } from '../../../../application/ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import type { RealtimeTicketUnitOfWork } from '../../../../application/ports/outbound/transactions/realtime-ticket/realtime-ticket-unit-of-work.port.js';
import { IssueRealtimeTicket } from '../../../../application/use-cases/commands/realtime-ticket/issue-realtime-ticket/issue-realtime-ticket.use-case.js';
import { REALTIME_TICKET_ACCESS } from '../../../tokens/realtime-ticket/realtime-ticket-access.token.js';
import { REALTIME_TICKET_UNIT_OF_WORK } from '../../../tokens/realtime-ticket/realtime-ticket-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { SESSION_TOKENS } from '../../../tokens/session/session-tokens.token.js';

/** Provides realtime ticket issuance to Sessions adapters. */
export const issueRealtimeTicketProvider: FactoryProvider<IssueRealtimeTicket> = {
  provide: IssueRealtimeTicket,
  inject: [REALTIME_TICKET_UNIT_OF_WORK, REALTIME_TICKET_ACCESS, SESSION_TOKENS, CLOCK],
  useFactory: (
    unitOfWork: RealtimeTicketUnitOfWork,
    access: RealtimeTicketAccessPort,
    tokens: SessionTokens,
    clock: Clock,
  ): IssueRealtimeTicket => new IssueRealtimeTicket(unitOfWork, access, tokens, clock),
};
