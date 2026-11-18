/**
 * Interface OrganizationAccess
 *
 * @description
 * The authentication policy of the organizations, which the sessions module owns and applies:
 * whether an organization is withheld from a member for want of two-step verification. Called
 * inside the system transaction of the introspection, it joins it.
 */
export interface OrganizationAccess {
  // #region Methods
  /**
   * Method isWithheld
   *
   * @description
   * Whether the policy of the organization requires two-step verification for the role of the
   * member, whose account has none.
   *
   * @param {string} organizationId - The organization of the token.
   * @param {string} userId - The account of the token.
   * @param {'owner' | 'admin' | 'member' | 'guest'} role - Its role there.
   * @returns {Promise<boolean>} `true` when the token acts on nothing.
   */
  isWithheld(
    organizationId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member' | 'guest',
  ): Promise<boolean>;
  // #endregion
}
