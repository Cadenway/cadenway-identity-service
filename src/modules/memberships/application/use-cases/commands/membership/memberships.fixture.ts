import { Membership } from '../../../../domain/aggregates/membership/membership.aggregate.js';
import type { MembershipState } from '../../../../domain/value-objects/membership/membership-state.value-object.js';
import type { MembershipRepository } from '../../../ports/outbound/persistence/membership/membership-repository.port.js';
import type { MembershipsUnitOfWork } from '../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';

/**
 * Class InMemoryMemberships
 *
 * @description
 * A fake `MembershipsUnitOfWork` holding the copy in memory, committed only when the work resolves.
 * Rows keep their insertion order, which stands for `created_at`.
 */
export class InMemoryMemberships implements MembershipsUnitOfWork {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * Committed memberships by id.
   *
   * @type {Map<string, MembershipState>}
   */
  public rows: Map<string, MembershipState> = new Map<string, MembershipState>();

  /**
   * Property writes
   *
   * @description
   * Inserts and updates committed.
   *
   * @type {number}
   */
  public writes: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs the work on a copy of the rows, committed when it resolves.
   *
   * @param {(memberships: MembershipRepository) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with.
   */
  public async run<TResult>(
    work: (memberships: MembershipRepository) => Promise<TResult>,
  ): Promise<TResult> {
    const rows: Map<string, MembershipState> = new Map<string, MembershipState>(this.rows);
    const writes: { count: number } = { count: this.writes };
    const repository: MembershipRepository = {
      lock: (organizationId: string, id: string): Promise<Membership | null> => {
        const state: MembershipState | undefined = rows.get(id);
        return Promise.resolve(
          state?.organizationId === organizationId ? Membership.restore(state) : null,
        );
      },
      insertIfAbsent: (membership: Membership): Promise<boolean> => {
        if (rows.has(membership.snapshot.id)) {
          return Promise.resolve(false);
        }
        rows.set(membership.snapshot.id, membership.snapshot);
        writes.count += 1;
        return Promise.resolve(true);
      },
      update: (membership: Membership): Promise<void> => {
        rows.set(membership.snapshot.id, membership.snapshot);
        writes.count += 1;
        return Promise.resolve();
      },
      findActive: (organizationId: string, userId: string): Promise<Membership | null> => {
        const state: MembershipState | undefined = [...rows.values()].findLast(
          (row: MembershipState) =>
            row.organizationId === organizationId &&
            row.userId === userId &&
            row.removedAt === null,
        );
        return Promise.resolve(state === undefined ? null : Membership.restore(state));
      },
      findOwnedOrganizationIds: (userId: string): Promise<string[]> =>
        Promise.resolve(
          [
            ...new Set(
              [...rows.values()]
                .filter(
                  (row: MembershipState) =>
                    row.userId === userId && row.role === 'owner' && row.removedAt === null,
                )
                .map((row: MembershipState) => row.organizationId),
            ),
          ].sort(),
        ),
    };
    const result: TResult = await work(repository);
    this.rows = rows;
    this.writes = writes.count;
    return result;
  }
  // #endregion
}
