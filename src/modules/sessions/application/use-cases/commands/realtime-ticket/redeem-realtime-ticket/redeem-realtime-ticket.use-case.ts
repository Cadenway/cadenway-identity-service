import { RealtimeTicketUnusableError } from '../../../../../domain/errors/realtime-ticket/realtime-ticket-unusable.error.js';
import { RealtimeTicketNotFound } from '../../../../models/realtime-ticket/realtime-ticket-not-found.model.js';
import type { RealtimeTicketAccessPort } from '../../../../ports/outbound/memberships/realtime-ticket/realtime-ticket-access.port.js';
import type { SessionTokens } from '../../../../ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { RealtimeTicketUnitOfWork } from '../../../../ports/outbound/transactions/realtime-ticket/realtime-ticket-unit-of-work.port.js';
import type { RedeemRealtimeTicketInput } from './redeem-realtime-ticket.input.js';
import type { RedeemRealtimeTicketOutput } from './redeem-realtime-ticket.output.js';

/** Consumes one ticket while holding its session, ticket and current access in one transaction. */
export class RedeemRealtimeTicket {
  // #region Constructor
  /** Binds the system transaction, locked authorization, digest source and clock. */
  public constructor(
    private readonly work: RealtimeTicketUnitOfWork,
    private readonly access: RealtimeTicketAccessPort,
    private readonly tokens: SessionTokens,
    private readonly clock: Clock,
  ) {}
  // #endregion

  // #region Methods
  /** Returns current identity only after single-use consumption commits. */
  public async execute(input: RedeemRealtimeTicketInput): Promise<RedeemRealtimeTicketOutput> {
    const tokenHash = this.tokens.hashOf(input.token);
    if (tokenHash === null) throw new RealtimeTicketNotFound();
    return this.work.run(async (store) => {
      const discovered = await store.tickets.find(tokenHash);
      if (!discovered?.isOpenAt(this.clock.now())) {
        throw new RealtimeTicketNotFound();
      }
      const binding = discovered.snapshot;
      const authorization = await this.access.resolveForUpdate(
        binding.organizationId,
        binding.userId,
      );
      if (authorization.status !== 'allowed') throw new RealtimeTicketNotFound();
      const current = await store.sessions.findForUpdate(binding.sessionId);
      if (current === null) throw new RealtimeTicketNotFound();
      const ticket = await store.tickets.findForUpdate(tokenHash);
      if (
        ticket?.snapshot.sessionId !== binding.sessionId ||
        ticket.snapshot.organizationId !== binding.organizationId ||
        ticket.snapshot.userId !== binding.userId
      ) {
        throw new RealtimeTicketNotFound();
      }
      let consumed;
      try {
        consumed = ticket.redeem(current, authorization.membership.memberId, this.clock.now());
      } catch (error: unknown) {
        if (error instanceof RealtimeTicketUnusableError) throw new RealtimeTicketNotFound();
        throw error;
      }
      await store.tickets.consume(consumed);
      return {
        sessionId: current.id,
        sessionVersion: current.snapshot.version,
        userId: current.userId,
        organizationId: binding.organizationId,
        memberId: authorization.membership.memberId,
        role: authorization.membership.role,
        sessionExpiresAt: current.activeUntil,
      };
    });
  }
  // #endregion
}
