import type { FederatedFinishStore } from './federated-finish-store.port.js';

/** Commits receipt consumption and session or challenge creation together. */
export interface FederatedFinishUnitOfWork {
  // #region Methods
  /** Runs one finish operation in a system transaction. */
  run<TResult>(work: (store: FederatedFinishStore) => Promise<TResult>): Promise<TResult>;
  // #endregion
}
