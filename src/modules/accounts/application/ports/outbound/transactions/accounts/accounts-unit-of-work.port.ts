import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { UnitOfWorkOptions } from '../../../../models/transactions/unit-of-work-options.model.js';

/**
 * Interface AccountsUnitOfWork
 *
 * @description
 * One transaction of the accounts module. The work commits when it resolves and rolls back when it
 * rejects: a use case that must keep a counted failure returns its refusal and throws it after the
 * commit. A session opened through the `SessionOpener` port inside the work joins the transaction.
 */
export interface AccountsUnitOfWork {
  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in one transaction with the repositories bound to it.
   *
   * @param {(store: AccountsStore) => Promise<TResult>} work - The unit of work.
   * @param {UnitOfWorkOptions} options - How the transaction is opened.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  run<TResult>(
    work: (store: AccountsStore) => Promise<TResult>,
    options?: UnitOfWorkOptions,
  ): Promise<TResult>;
  // #endregion
}
