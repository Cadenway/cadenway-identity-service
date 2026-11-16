import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';

/**
 * Interface SessionsUnitOfWork
 *
 * @description
 * One transaction of the sessions module. Run inside the transaction of a sign-in of the accounts
 * module, it joins it: the session commits with the sign-in.
 */
export interface SessionsUnitOfWork {
  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in one transaction with the repository bound to it; commits when it resolves.
   *
   * @param {(store: SessionsStore) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  run<TResult>(work: (store: SessionsStore) => Promise<TResult>): Promise<TResult>;
  // #endregion
}
