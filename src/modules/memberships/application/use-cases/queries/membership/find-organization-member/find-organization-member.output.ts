/**
 * Interface FindOrganizationMemberOutput
 *
 * @description
 * The active membership of an account in the organization of the tenant transaction.
 */
export interface FindOrganizationMemberOutput {
  // #region Properties
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
