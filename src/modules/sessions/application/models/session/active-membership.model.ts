/**
 * Interface ActiveMembership
 *
 * @description
 * An active membership of an account, as the copy of the memberships answers it.
 */
export interface ActiveMembership {
  // #region Properties
  /**
   * Property memberId
   *
   * @description
   * Id of the membership.
   *
   * @type {string}
   * @readonly
   */
  readonly memberId: string;

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
   * Role of the account in the organization.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  // #endregion
}
