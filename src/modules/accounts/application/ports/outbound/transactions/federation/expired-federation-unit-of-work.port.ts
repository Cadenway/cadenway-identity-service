import type { PurgeExpiredFederationOutput } from '../../../../use-cases/commands/federated-sign-in/purge-expired-federation/purge-expired-federation.output.js';

/** Deletes available expired federation rows in a short system transaction. */
export interface ExpiredFederationUnitOfWork {
  // #region Methods
  /** Claims at most the supplied number of rows per source through its storage deadline. */
  deleteBatch(limit: number): Promise<PurgeExpiredFederationOutput>;
  // #endregion
}
