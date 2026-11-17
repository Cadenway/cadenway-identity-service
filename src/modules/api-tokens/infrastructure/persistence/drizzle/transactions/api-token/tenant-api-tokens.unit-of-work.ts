import type { TenantTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';

import type { ApiTokenRepository } from '../../../../../application/ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { ApiTokensUnitOfWork } from '../../../../../application/ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import { DrizzleApiTokenRepository } from '../../repositories/api-token/drizzle-api-token.repository.js';

/**
 * Class TenantApiTokensUnitOfWork
 *
 * @description
 * `ApiTokensUnitOfWork` on the tenant transaction runner, for the routes of a session: their
 * internal token carries the current organization of the session (`organization: 'required'`), so
 * the runner sets it for the transaction and row-level security keeps the work inside it.
 */
export class TenantApiTokensUnitOfWork implements ApiTokensUnitOfWork {
  // #region Properties
  /**
   * Property runner
   *
   * @description
   * The tenant transaction runner of the kit.
   *
   * @type {TenantTransactionRunner}
   * @readonly
   */
  private readonly runner: TenantTransactionRunner;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the runner of the kit.
   *
   * @param {TenantTransactionRunner} runner - The tenant transaction runner.
   * @constructor
   */
  public constructor(runner: TenantTransactionRunner) {
    this.runner = runner;
  }
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in a tenant transaction of the organization of the request.
   *
   * @param {(tokens: ApiTokenRepository) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  public run<TResult>(work: (tokens: ApiTokenRepository) => Promise<TResult>): Promise<TResult> {
    return this.runner.run((transaction: TransactionScope): Promise<TResult> =>
      work(new DrizzleApiTokenRepository(transaction.db)),
    );
  }
  // #endregion
}
