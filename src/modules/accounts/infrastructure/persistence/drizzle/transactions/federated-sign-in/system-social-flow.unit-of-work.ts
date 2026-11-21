import { assertNoActiveTransaction } from '@cadenway/nest-common/database';
import type { SystemTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';
import { sql } from 'drizzle-orm';

import type { SocialFlowStore } from '../../../../../application/ports/outbound/transactions/federation/social-flow-store.port.js';
import type { SocialFlowUnitOfWork } from '../../../../../application/ports/outbound/transactions/federation/social-flow-unit-of-work.port.js';
import type { FederatedConnection } from '../../../../../domain/value-objects/federated-sign-in/federated-connection.value-object.js';
import { DrizzleUserRepository } from '../../repositories/accounts/drizzle-user.repository.js';
import { DrizzleFederatedAccountLinkRepository } from '../../repositories/federated-sign-in/drizzle-federated-account-link.repository.js';
import { DrizzleFederatedSignInFlowRepository } from '../../repositories/federated-sign-in/drizzle-federated-sign-in-flow.repository.js';

/**
 * Type CheckSocialAuthority
 *
 * @description
 * Checks the current authority policy using the supplied transaction. This callback must perform
 * database work only because the system runner may retry the transaction.
 *
 * @type {(scope: TransactionScope, userId: string, connection: FederatedConnection) => Promise<boolean>}
 */
type CheckSocialAuthority = (
  scope: TransactionScope,
  userId: string,
  connection: FederatedConnection,
) => Promise<boolean>;

/**
 * Class SystemSocialFlowUnitOfWork
 *
 * @description
 * Opens a committed transaction for each stage of a social sign-in. The authority check is
 * supplied by composition and receives the same scope as the locked account and identity link.
 */
export class SystemSocialFlowUnitOfWork implements SocialFlowUnitOfWork {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Requires the current authority policy check explicitly, with no permissive fallback.
   *
   * @param {SystemTransactionRunner} runner - The system transaction runner.
   * @param {CheckSocialAuthority} checkAuthority - The transaction-bound policy check.
   * @constructor
   */
  public constructor(
    private readonly runner: SystemTransactionRunner,
    private readonly checkAuthority: CheckSocialAuthority,
  ) {
    if (typeof checkAuthority !== 'function') {
      throw new Error('A transaction-bound social authority check is required.');
    }
  }
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Commits this stage before returning, so external provider calls occur after the claim commits.
   * An enclosing transaction is rejected because the system runner would otherwise join it.
   *
   * @template TResult
   * @param {(store: SocialFlowStore) => Promise<TResult>} work - The stage to commit.
   * @returns {Promise<TResult>} The stage result after its transaction commits.
   */
  public async run<TResult>(work: (store: SocialFlowStore) => Promise<TResult>): Promise<TResult> {
    assertNoActiveTransaction();
    return this.runner.run(async (scope: TransactionScope): Promise<TResult> => {
      const flows = new DrizzleFederatedSignInFlowRepository(scope);
      const links = new DrizzleFederatedAccountLinkRepository(scope);
      const users = new DrizzleUserRepository(scope.db);
      return work({
        nextFlowId: async () => {
          const result = await scope.db.execute<{ id: string }>(sql`select uuidv7() as id`);
          const id = result.rows[0]?.id;
          if (id === undefined) throw new Error('The database did not allocate a social flow ID.');
          return id;
        },
        insert: (flow) => flows.insert(flow),
        findByStateHash: (hash) => flows.findByStateHash(hash),
        save: (flow, version) => flows.save(flow, version),
        findLink: (identity) => links.findByIdentity(identity),
        isEligible: async (userId, connection) => {
          const user = await users.lock(userId);
          if (!user?.isVerified) return false;
          return this.checkAuthority(scope, userId, connection);
        },
      });
    });
  }
  // #endregion
}
