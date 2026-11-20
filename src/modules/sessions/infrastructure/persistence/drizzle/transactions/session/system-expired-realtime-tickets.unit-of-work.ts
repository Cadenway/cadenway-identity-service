import type { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { asc, inArray, lte } from 'drizzle-orm';

import type { ExpiredRealtimeTicketsUnitOfWork } from '../../../../../application/ports/outbound/transactions/realtime-ticket/expired-realtime-tickets-unit-of-work.port.js';
import tickets from '../../schemas/session/realtime-ticket.schema.js';

/** Deletes only the expired rows claimed by the scheduled system maintenance job. */
export class SystemExpiredRealtimeTicketsUnitOfWork implements ExpiredRealtimeTicketsUnitOfWork {
  // #region Constructor
  /** Uses the system runner to reach expired ticket rows across organizations. */
  public constructor(private readonly runner: SystemTransactionRunner) {}
  // #endregion

  // #region Methods
  /** Claims an indexed batch without waiting for a ticket locked by redemption or another sweep. */
  public deleteBatch(cutoff: Date, limit: number): Promise<number> {
    return this.runner.run(async ({ db }): Promise<number> => {
      const expired = db
        .$with('expired_tickets')
        .as(
          db
            .select({ tokenHash: tickets.tokenHash })
            .from(tickets)
            .where(lte(tickets.expiresAt, cutoff))
            .orderBy(asc(tickets.expiresAt), asc(tickets.tokenHash))
            .limit(limit)
            .for('update', { skipLocked: true }),
        );
      const result = await db
        .with(expired)
        .delete(tickets)
        .where(
          inArray(tickets.tokenHash, db.select({ tokenHash: expired.tokenHash }).from(expired)),
        );
      return result.rowCount ?? 0;
    });
  }
  // #endregion
}
