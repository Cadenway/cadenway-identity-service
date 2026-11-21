import type { SocialFlowStore } from './social-flow-store.port.js';

/** Opens a global Identity transaction and commits only when its callback resolves. */
export interface SocialFlowUnitOfWork {
  // #region Methods
  /** Runs one operation with flow and link repositories bound to the same transaction. */
  run<TResult>(work: (store: SocialFlowStore) => Promise<TResult>): Promise<TResult>;
  // #endregion
}
