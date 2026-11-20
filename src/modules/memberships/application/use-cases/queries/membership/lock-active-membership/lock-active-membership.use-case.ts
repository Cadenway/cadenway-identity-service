import type { MembershipsUnitOfWork } from '../../../../ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import type { LockActiveMembershipInput } from './lock-active-membership.input.js';
import type { LockActiveMembershipOutput } from './lock-active-membership.output.js';

/** Locks the current membership in the caller's system transaction. */
export class LockActiveMembership {
  // #region Constructor
  /** Binds the system unit of work. */
  public constructor(private readonly unitOfWork: MembershipsUnitOfWork) {}
  // #endregion

  // #region Methods
  /** Returns the latest active membership, or null if the projection has none. */
  public async execute(
    input: LockActiveMembershipInput,
  ): Promise<LockActiveMembershipOutput | null> {
    const membership = await this.unitOfWork.run((memberships) =>
      memberships.lockActive(input.organizationId, input.userId),
    );
    if (membership === null) return null;
    const { id, organizationId, userId, role } = membership.snapshot;
    return { memberId: id, organizationId, userId, role };
  }
  // #endregion
}
