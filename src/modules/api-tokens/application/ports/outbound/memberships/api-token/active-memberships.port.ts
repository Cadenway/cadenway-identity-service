import type { ActiveMembership } from '../../../../models/api-token/active-membership.model.js';

/**
 * Interface ActiveMemberships
 *
 * @description
 * The copy of the memberships, which the memberships module owns. Called inside the system
 * transaction of the introspection, it joins it.
 */
export interface ActiveMemberships {
  // #region Methods
  /**
   * Method find
   *
   * @description
   * The active membership of an account in an organization.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The account.
   * @returns {Promise<ActiveMembership | null>} The membership, or `null` when the account is not a
   * member there.
   */
  find(organizationId: string, userId: string): Promise<ActiveMembership | null>;
  // #endregion
}
