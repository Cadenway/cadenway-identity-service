/**
 * Interface UserMembership
 *
 * @description
 * An active membership of an account, as the copy of the memberships holds it: its organization and
 * its role there.
 */
export interface UserMembership {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property role
   *
   * @description
   * The role of the account there.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  // #endregion
}
