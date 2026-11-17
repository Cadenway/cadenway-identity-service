/**
 * Interface FindActiveMembershipOutput
 *
 * @description
 * An active membership of the copy: the account is a member of the organization with this role.
 */
export interface FindActiveMembershipOutput {
  // #region Properties
  /**
   * Property memberId
   *
   * @description
   * Id of the membership: a person who joins again after a removal gets a new one.
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
   * Property userId
   *
   * @description
   * The account.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

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
