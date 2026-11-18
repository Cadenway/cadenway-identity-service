/**
 * Interface OrganizationMember
 *
 * @description
 * An active member of an organization, as the copy of the memberships holds it.
 */
export interface OrganizationMember {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account of the member.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property role
   *
   * @description
   * Its role in the organization.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  // #endregion
}
