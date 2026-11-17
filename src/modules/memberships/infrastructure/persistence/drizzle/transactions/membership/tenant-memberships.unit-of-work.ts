import type { TenantTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';

import type { MembershipRepository } from '../../../../../application/ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { DrizzleMembershipRepository } from '../../repositories/membership/drizzle-membership.repository.js';

/**
 * Class TenantMembershipsUnitOfWork
 *
 * @description
 * `MembershipsUnitOfWork` on the tenant transaction runner, for the handlers of the member events:
 * the consumer of the kit runs each event in the organization context of its envelope and its
 * deduplicator opens the tenant transaction that records the event id, which `run` joins. Row-level
 * security then limits the work to the organization of the event.
 */
export class TenantMembershipsUnitOfWork implements MembershipsUnitOfWork {
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
   * Runs `work` in the tenant transaction of the current organization context, joining the one of
   * the deduplicator.
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
