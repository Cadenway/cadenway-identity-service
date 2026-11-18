import type { OrganizationMember } from '../../../../models/authentication-policy/organization-member.model.js';

/**
 * Interface OrganizationMembers
 *
 * @description
 * The members of the organization of a policy route, from the copy of the memberships the
 * memberships module owns. Called inside the tenant transaction of the route, it joins it.
 */
export interface OrganizationMembers {
  // #region Methods
  /**
   * Method roleOf
   *
   * @description
   * The role of an account in the organization.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The account.
   * @returns {Promise<'owner' | 'admin' | 'member' | 'guest' | null>} Its role, or `null` when it
   * is not a member there, or not yet known as one.
   */
  roleOf(
    organizationId: string,
    userId: string,
  ): Promise<'owner' | 'admin' | 'member' | 'guest' | null>;

  /**
   * Method list
   *
   * @description
   * Every active member of the organization.
   *
   * @param {string} organizationId - The organization.
   * @returns {Promise<readonly OrganizationMember[]>} The members.
   */
  list(organizationId: string): Promise<readonly OrganizationMember[]>;
  // #endregion
}
