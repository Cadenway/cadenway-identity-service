/**
 * Interface CheckOrganizationAccessInput
 *
 * @description
 * A member acting on an organization, as the introspection of a personal API token found it.
 */
export interface CheckOrganizationAccessInput {
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
   * Its role there, from the copy of the memberships.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  // #endregion
}
