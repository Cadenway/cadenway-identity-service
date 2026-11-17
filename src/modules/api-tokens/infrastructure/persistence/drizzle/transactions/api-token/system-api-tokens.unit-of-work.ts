import type { SystemTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';

import type { ApiTokenRepository } from '../../../../../application/ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { ApiTokensUnitOfWork } from '../../../../../application/ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import { DrizzleApiTokenRepository } from '../../repositories/api-token/drizzle-api-token.repository.js';

/**
 * Class SystemApiTokensUnitOfWork
 *
 * @description
 * `ApiTokensUnitOfWork` on the system transaction runner, for the introspection only: the gateway
 * calls it as itself, without an organization, and the organization of a token is known once the
 * token is found. A bounded exception to the tenant runner (see MODULE.md): the work finds one
 * token by the hash of its secret, writes its last use, and reads the copy of the memberships for
 * its organization and user.
 */
export class SystemApiTokensUnitOfWork implements ApiTokensUnitOfWork {
  // #region Properties
  /**
   * Property runner
   *
   * @description
   * The system transaction runner of the kit.
   *
   * @type {SystemTransactionRunner}
   * @readonly
   */
  private readonly runner: SystemTransactionRunner;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the runner of the kit.
   *
   * @param {SystemTransactionRunner} runner - The system transaction runner.
   * @constructor
   */
  public constructor(runner: SystemTransactionRunner) {
    this.runner = runner;
  }
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in one system transaction, joining the current one when called inside it.
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
