import type { RealtimeTicketStore } from '../../../../models/realtime-ticket/realtime-ticket-store.model.js';

/** Opens one system transaction for ticket issuance or consumption. */
export interface RealtimeTicketUnitOfWork {
  // #region Methods
  /** Runs the work and resolves only after its transaction commits. */
  run<TResult>(work: (store: RealtimeTicketStore) => Promise<TResult>): Promise<TResult>;
  // #endregion
}
