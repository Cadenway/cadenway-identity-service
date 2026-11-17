import type { SystemTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';

import type { MembershipRepository } from '../../../../../application/ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { DrizzleMembershipRepository } from '../../repositories/membership/drizzle-membership.repository.js';

/**
 * Class SystemMembershipsUnitOfWork
 *
 * @description
 * `MembershipsUnitOfWork` on the system transaction runner, for the reading other modules consume:
 * the choice of an organization, the introspection of a session or of an API token and the opening
 * of a session have no organization yet, and run in a system transaction that `run` joins. A
 * bounded exception to the tenant runner (see MODULE.md): the work reads the copy only, and names
 * the organization and the account of every read.
 */
export class SystemMembershipsUnitOfWork implements MembershipsUnitOfWork {
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
   * Runs `work` in a system transaction, joining the current one when called inside it.
   *
   * @param {(memberships: MembershipRepository) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  public run<TResult>(
    work: (memberships: MembershipRepository) => Promise<TResult>,
  ): Promise<TResult> {
    return this.runner.run((transaction: TransactionScope): Promise<TResult> =>
      work(new DrizzleMembershipRepository(transaction.db)),
    );
  }
  // #endregion
}
