import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { ExpiredRealtimeTicketsUnitOfWork } from '../../../../ports/outbound/transactions/realtime-ticket/expired-realtime-tickets-unit-of-work.port.js';

const BATCH_SIZE: number = 100;

/** Removes expired credentials with short, independently committed transactions. */
export class PurgeExpiredRealtimeTickets {
  // #region Constructor
  /** Binds the expiry transaction and the same clock used to issue tickets. */
  public constructor(
    private readonly work: ExpiredRealtimeTicketsUnitOfWork,
    private readonly clock: Clock,
  ) {}
  // #endregion

  // #region Methods
  /** Drains available expired rows at the start of the sweep and returns a count. */
  public async execute(signal: AbortSignal): Promise<number> {
    const cutoff: Date = this.clock.now();
    let total: number = 0;
    let count: number;
    do {
      signal.throwIfAborted();
      count = await this.work.deleteBatch(cutoff, BATCH_SIZE);
      total += count;
    } while (count === BATCH_SIZE);
    return total;
  }
  // #endregion
}
