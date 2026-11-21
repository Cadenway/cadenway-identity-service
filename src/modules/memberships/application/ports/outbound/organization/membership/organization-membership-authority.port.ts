import type { FindAuthoritativeMembershipOutput } from '../../../../use-cases/queries/membership/find-authoritative-membership/find-authoritative-membership.output.js';

/** Reads the current membership from the organization that owns it. */
export interface OrganizationMembershipAuthority {
  // #region Methods
  /** Confirms the current generation and role for the given actor and tenant. */
  find(
    organizationId: string,
    userId: string,
  ): Promise<Pick<FindAuthoritativeMembershipOutput, 'memberId' | 'role'> | null>;
  // #endregion
}
