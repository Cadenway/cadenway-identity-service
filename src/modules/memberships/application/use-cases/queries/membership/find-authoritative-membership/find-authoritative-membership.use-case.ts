import type { OrganizationMembershipAuthority } from '../../../../ports/outbound/organization/membership/organization-membership-authority.port.js';
import type { FindAuthoritativeMembershipInput } from './find-authoritative-membership.input.js';
import type { FindAuthoritativeMembershipOutput } from './find-authoritative-membership.output.js';

/** Confirms the membership of a verified credential outside its local transaction. */
export class FindAuthoritativeMembership {
  // #region Constructor
  /** Binds the Organization membership reader. */
  public constructor(private readonly authority: OrganizationMembershipAuthority) {}
  // #endregion

  // #region Methods
  /** Returns the current proof or null when the owner confirms the account is not a member. */
  public async execute(
    input: FindAuthoritativeMembershipInput,
  ): Promise<FindAuthoritativeMembershipOutput | null> {
    const proof = await this.authority.find(input.organizationId, input.userId);
    return proof === null ? null : { ...input, memberId: proof.memberId, role: proof.role };
  }
  // #endregion
}
