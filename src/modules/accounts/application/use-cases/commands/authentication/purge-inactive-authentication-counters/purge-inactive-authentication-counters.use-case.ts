import type { InactiveAuthenticationCountersUnitOfWork } from '../../../../ports/outbound/transactions/accounts/inactive-authentication-counters-unit-of-work.port.js';

const BATCH_SIZE = 500;
const MAX_BATCHES = 4;

/** Removes inactive counters using independently committed transactions. */
export class PurgeInactiveAuthenticationCounters {
  // #region Constructor
  /** Binds the retention transaction used by the durable sweep. */
  public constructor(private readonly work: InactiveAuthenticationCountersUnitOfWork) {}
  // #endregion

  // #region Methods
  /** Leaves locked rows and any remaining backlog for the next occurrence. */
  public async execute(signal: AbortSignal): Promise<number> {
    let total = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      signal.throwIfAborted();
      const deleted = await this.work.deleteBatch(BATCH_SIZE);
      total += deleted;
      if (deleted < BATCH_SIZE) break;
    }
    return total;
  }
  // #endregion
}
