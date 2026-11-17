import type { MembershipRepository } from '../../persistence/membership/membership-repository.port.js';

/**
 * Interface MembershipsUnitOfWork
 *
 * @description
 * One transaction of the memberships module. The handler of a member event runs in the tenant
 * transaction of the organization of the event, opened by the deduplicator of the kit, and joins
 * it; a reading of another module runs in the system transaction of its caller, and joins it too.
 */
export interface MembershipsUnitOfWork {
  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in one transaction with the repository bound to it; commits when it resolves.
   *
   * @param {(memberships: MembershipRepository) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  run<TResult>(work: (memberships: MembershipRepository) => Promise<TResult>): Promise<TResult>;
  // #endregion
}
