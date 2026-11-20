import type { RealtimeTicket } from '../../../../../domain/aggregates/realtime-ticket/realtime-ticket.aggregate.js';

/** Digest-keyed ticket persistence in the caller's system transaction. */
export interface RealtimeTicketRepository {
  // #region Methods
  /** Reads the immutable binding without a lock, before authorization and session locks. */
  find(tokenHash: string): Promise<RealtimeTicket | null>;

  /** Reloads and locks the ticket after its session has been locked. */
  findForUpdate(tokenHash: string): Promise<RealtimeTicket | null>;

  /** Inserts a newly issued digest and binding. */
  insert(ticket: RealtimeTicket): Promise<void>;

  /** Stores the consumed ticket while its row remains locked. */
  consume(ticket: RealtimeTicket): Promise<void>;
  // #endregion
}
