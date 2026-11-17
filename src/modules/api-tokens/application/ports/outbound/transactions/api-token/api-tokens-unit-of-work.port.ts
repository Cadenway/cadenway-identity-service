import type { ApiTokenRepository } from '../../persistence/api-token/api-token-repository.port.js';

/**
 * Interface ApiTokensUnitOfWork
 *
 * @description
 * One transaction of the api-tokens module: the tenant transaction of the organization of the
 * internal token for the routes of a session, a system transaction for the introspection, which
 * has no organization yet.
 */
export interface ApiTokensUnitOfWork {
  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in one transaction with the repository bound to it; commits when it resolves.
   *
   * @param {(tokens: ApiTokenRepository) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  run<TResult>(work: (tokens: ApiTokenRepository) => Promise<TResult>): Promise<TResult>;
  // #endregion
}
