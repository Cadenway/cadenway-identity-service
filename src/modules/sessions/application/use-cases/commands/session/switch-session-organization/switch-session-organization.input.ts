/**
 * Interface SwitchSessionOrganizationInput
 *
 * @description
 * Who moves which session to which organization.
 */
export interface SwitchSessionOrganizationInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The user of the verified internal token, never a value of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session, as the introspection returned it.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property organizationId
   *
   * @description
   * The organization chosen (`OrganizationChoice` of the contract).
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;
  // #endregion
}
