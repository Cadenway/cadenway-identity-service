import { RealtimeTicket } from '../../../../../domain/aggregates/realtime-ticket/realtime-ticket.aggregate.js';
import { OrganizationMfaRequired } from '../../../../models/session/organization-mfa-required.model.js';
import { OrganizationNotFound } from '../../../../models/session/organization-not-found.model.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import { RealtimeOrganizationNotSelected } from '../../../../models/realtime-ticket/realtime-organization-not-selected.model.js';
import type { RealtimeTicketAccessPort } from '../../../../ports/outbound/memberships/realtime-ticket/realtime-ticket-access.port.js';
import type { SessionTokens } from '../../../../ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { RealtimeTicketUnitOfWork } from '../../../../ports/outbound/transactions/realtime-ticket/realtime-ticket-unit-of-work.port.js';
import type { IssueRealtimeTicketInput } from './issue-realtime-ticket.input.js';
import type { IssueRealtimeTicketOutput } from './issue-realtime-ticket.output.js';

/** Issues one digest-bound ticket after locking and checking the current session and access. */
export class IssueRealtimeTicket {
  // #region Constructor
  /** Binds the system transaction, locked authorization, credential source and clock. */
  public constructor(
    private readonly work: RealtimeTicketUnitOfWork,
    private readonly access: RealtimeTicketAccessPort,
    private readonly tokens: SessionTokens,
    private readonly clock: Clock,
  ) {}
  // #endregion

  // #region Methods
  /** Returns the new credential only after the transaction has committed. */
  public execute(input: IssueRealtimeTicketInput): Promise<IssueRealtimeTicketOutput> {
    return this.work.run(async (store) => {
      const session = await store.sessions.findById(input.sessionId);
      if (session?.userId !== input.actorUserId || !session.isActiveAt(this.clock.now())) {
        throw new SessionNotFound();
      }
      if (session.organizationId !== input.organizationId) {
        throw new RealtimeOrganizationNotSelected();
      }
      const authorization = await this.access.resolveForUpdate(
        input.organizationId,
        input.actorUserId,
      );
      // Policy writers lock the policy before a session. Read the session again under both locks.
      const current = await store.sessions.findForUpdate(input.sessionId);
      const now = this.clock.now();
      if (current?.userId !== input.actorUserId || !current.isActiveAt(now)) {
        throw new SessionNotFound();
      }
      if (current.organizationId !== input.organizationId) {
        throw new RealtimeOrganizationNotSelected();
      }
      if (authorization.status === 'unavailable') throw new OrganizationNotFound();
      if (authorization.status === 'mfa-required') {
        throw new OrganizationMfaRequired(input.organizationId);
      }
      if (!current.isActingThrough(authorization.membership.memberId)) {
        throw new OrganizationNotFound();
      }
      const credential = this.tokens.issue();
      const ticket = RealtimeTicket.issue(
        current,
        authorization.membership.memberId,
        credential.tokenHash,
        now,
      );
      await store.tickets.insert(ticket);
      return { token: credential.token, expiresAt: ticket.snapshot.expiresAt };
    });
  }
  // #endregion
}
