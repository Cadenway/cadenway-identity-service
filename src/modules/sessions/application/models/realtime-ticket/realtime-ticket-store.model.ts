import type { RealtimeTicketRepository } from '../../ports/outbound/persistence/realtime-ticket/realtime-ticket-repository.port.js';
import type { SessionRepository } from '../../ports/outbound/persistence/session/session-repository.port.js';

/** Repositories sharing the system transaction that issues or redeems a ticket. */
export interface RealtimeTicketStore {
  // #region Properties
  /** Session reads are by explicit id. */
  readonly sessions: Pick<SessionRepository, 'findById' | 'findForUpdate'>;

  /** Tickets are identified only by the credential digest. */
  readonly tickets: RealtimeTicketRepository;
  // #endregion
}
