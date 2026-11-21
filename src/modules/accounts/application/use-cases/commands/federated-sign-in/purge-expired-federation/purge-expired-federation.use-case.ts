import type { ExpiredFederationUnitOfWork } from '../../../../ports/outbound/transactions/federation/expired-federation-unit-of-work.port.js';
import type { PurgeExpiredFederationOutput } from './purge-expired-federation.output.js';

const BATCH_SIZE: number = 250;
const MAX_BATCHES: number = 4;

/** Removes expired sign-in flows and replay markers in bounded, independently committed batches. */
export class PurgeExpiredFederation {
  // #region Constructor
  /** Binds the expiry transaction used by the durable sweep. */
  public constructor(private readonly work: ExpiredFederationUnitOfWork) {}
  // #endregion

  // #region Methods
  /** Lets the next scheduled sweep resume any remaining work or rows locked by callbacks. */
  public async execute(signal: AbortSignal): Promise<PurgeExpiredFederationOutput> {
    let flows = 0;
    let assertions = 0;
    for (let index = 0; index < MAX_BATCHES; index += 1) {
      signal.throwIfAborted();
      const deleted = await this.work.deleteBatch(BATCH_SIZE);
      flows += deleted.flows;
      assertions += deleted.assertions;
      if (deleted.flows < BATCH_SIZE && deleted.assertions < BATCH_SIZE) break;
    }
    return { flows, assertions };
  }
  // #endregion
}
