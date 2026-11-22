import { RealtimeTicketUnusableError } from '../../../../../domain/errors/realtime-ticket/realtime-ticket-unusable.error.js';
import { RealtimeTicketNotFound } from '../../../../models/realtime-ticket/realtime-ticket-not-found.model.js';
import type { RealtimeTicketAccessPort } from '../../../../ports/outbound/memberships/realtime-ticket/realtime-ticket-access.port.js';
import type { ActiveMemberships } from '../../../../ports/outbound/memberships/session/active-memberships.port.js';
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
    private readonly authority: Pick<ActiveMemberships, 'find'> | null,
  ) {}
  // #endregion

  // #region Methods
  /** Returns current identity only after single-use consumption commits. */
  public async execute(input: RedeemRealtimeTicketInput): Promise<RedeemRealtimeTicketOutput> {
    const tokenHash = this.tokens.hashOf(input.token);
    if (tokenHash === null) throw new RealtimeTicketNotFound();
    if (this.authority === null) {
      throw new Error('Organization membership authority is required to redeem realtime tickets.');
    }
    const selected = await this.work.run(async (store) => {
      const ticket = await store.tickets.find(tokenHash);
      if (!ticket?.isOpenAt(this.clock.now())) return null;
      const session = await store.sessions.findById(ticket.snapshot.sessionId);
      return session === null ? null : { ticket, session };
    });
    if (selected === null) throw new RealtimeTicketNotFound();
    const binding = selected.ticket.snapshot;
    const samlMembership = selected.session.snapshot.samlMembership ?? null;
    if (samlMembership !== null && input.verifiesSamlSource !== true) {
      throw new RealtimeTicketNotFound();
    }
    const membership = await this.authority.find(binding.organizationId, binding.userId);
    if (membership?.memberId !== binding.memberId) {
      throw new RealtimeTicketNotFound();
    }
    if (samlMembership !== null) {
      const source = await this.authority.find(samlMembership.organizationId, binding.userId);
      if (source?.memberId !== samlMembership.memberId) {
        throw new RealtimeTicketNotFound();
      }
    }
    return this.work.run(async (store) => {
      const authorization = await this.access.resolveForUpdate(
        binding.organizationId,
        binding.userId,
      );
      if (
        authorization.status !== 'allowed' ||
        authorization.membership.memberId !== membership.memberId ||
        authorization.membership.role !== membership.role
      ) {
        throw new RealtimeTicketNotFound();
      }
      const current = await store.sessions.findForUpdate(binding.sessionId);
      if (current === null) throw new RealtimeTicketNotFound();
      const currentSamlMembership = current.snapshot.samlMembership ?? null;
      if (
        currentSamlMembership?.organizationId !== samlMembership?.organizationId ||
        currentSamlMembership?.memberId !== samlMembership?.memberId
      ) {
        throw new RealtimeTicketNotFound();
      }
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
        ...(samlMembership === null ? {} : { samlSourceMembership: samlMembership }),
      };
    });
  }
  // #endregion
}
