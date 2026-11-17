import type { ActiveMembership } from '../../../../models/session/active-membership.model.js';

/**
 * Interface ActiveMemberships
 *
 * @description
 * The copy of the memberships, which the memberships module owns. Called inside a unit of work of
 * this module, it joins its system transaction.
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
   * member there, or not yet known as one.
   */
  find(organizationId: string, userId: string): Promise<ActiveMembership | null>;
  // #endregion
}
