import type { SystemTransactionRunner } from '@cadenway/nest-common/database';

import type { RealtimeTicketStore } from '../../../../../application/models/realtime-ticket/realtime-ticket-store.model.js';
import type { RealtimeTicketUnitOfWork } from '../../../../../application/ports/outbound/transactions/realtime-ticket/realtime-ticket-unit-of-work.port.js';
import { DrizzleRealtimeTicketRepository } from '../../repositories/session/drizzle-realtime-ticket.repository.js';
import { DrizzleSessionRepository } from '../../repositories/session/drizzle-session.repository.js';

/** Runs account-bound ticket work in the system transaction, scoped by digest and session ID. */
export class SystemRealtimeTicketsUnitOfWork implements RealtimeTicketUnitOfWork {
  // #region Constructor
  /** Joins an active system transaction when called from another Identity operation. */
  public constructor(private readonly runner: SystemTransactionRunner) {}
  // #endregion

  // #region Methods
  /** Resolves after the system transaction commits. */
  public run<TResult>(work: (store: RealtimeTicketStore) => Promise<TResult>): Promise<TResult> {
    return this.runner.run(({ db }) =>
      work({
        sessions: new DrizzleSessionRepository(db),
        tickets: new DrizzleRealtimeTicketRepository(db),
      }),
    );
  }
  // #endregion
}
