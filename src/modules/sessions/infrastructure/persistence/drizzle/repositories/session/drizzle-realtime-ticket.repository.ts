import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, eq, isNull } from 'drizzle-orm';

import type { RealtimeTicketRepository } from '../../../../../application/ports/outbound/persistence/realtime-ticket/realtime-ticket-repository.port.js';
import { RealtimeTicket } from '../../../../../domain/aggregates/realtime-ticket/realtime-ticket.aggregate.js';
import tickets from '../../schemas/session/realtime-ticket.schema.js';

/** Reads ticket credentials by digest inside the caller's system transaction. */
export class DrizzleRealtimeTicketRepository implements RealtimeTicketRepository {
  // #region Constructor
  /** Binds all reads and writes to the transaction that holds the session lock. */
  public constructor(private readonly db: TransactionDatabase) {}
  // #endregion

  // #region Methods
  /** Discovers the binding before locking its session. */
  public async find(tokenHash: string): Promise<RealtimeTicket | null> {
    const rows = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.tokenHash, tokenHash))
      .limit(1);
    return rows[0] === undefined ? null : RealtimeTicket.restore(rows[0]);
  }

  /** Locks the named ticket after its owning session is locked. */
  public async findForUpdate(tokenHash: string): Promise<RealtimeTicket | null> {
    const rows = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.tokenHash, tokenHash))
      .limit(1)
      .for('update');
    return rows[0] === undefined ? null : RealtimeTicket.restore(rows[0]);
  }

  /** Stores the digest and immutable session binding. */
  public async insert(ticket: RealtimeTicket): Promise<void> {
    await this.db.insert(tickets).values(ticket.snapshot);
  }

  /** Uses a compare-and-set to reject duplicate or changed ticket consumption. */
  public async consume(ticket: RealtimeTicket): Promise<void> {
    const state = ticket.snapshot;
    if (state.redeemedAt === null) throw new Error('Cannot consume an unused ticket state.');
    const updated = await this.db
      .update(tickets)
      .set({ redeemedAt: state.redeemedAt })
      .where(
        and(
          eq(tickets.tokenHash, state.tokenHash),
          eq(tickets.sessionId, state.sessionId),
          eq(tickets.userId, state.userId),
          eq(tickets.organizationId, state.organizationId),
          eq(tickets.memberId, state.memberId),
          eq(tickets.sessionVersion, state.sessionVersion),
          isNull(tickets.redeemedAt),
        ),
      )
      .returning({ tokenHash: tickets.tokenHash });
    if (updated.length !== 1) throw new Error('The ticket could not be consumed.');
  }
  // #endregion
}
