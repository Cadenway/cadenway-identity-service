/**
 * Interface SwitchSessionOrganizationOutput
 *
 * @description
 * The organization the session acts on from the next introspection, and the role of the actor
 * there (`SessionOrganization` of the contract).
 */
export interface SwitchSessionOrganizationOutput {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The current organization of the session.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property role
   *
   * @description
   * Role of the actor in it, from the copy of the memberships.
   *
   * @type {'owner' | 'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  // #endregion
}
