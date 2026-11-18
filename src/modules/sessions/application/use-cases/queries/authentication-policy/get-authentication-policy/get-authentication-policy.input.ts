/**
 * Interface GetAuthenticationPolicyInput
 *
 * @description
 * A reading of the authentication policy of the organization of the internal token.
 */
export interface GetAuthenticationPolicyInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The actor, from the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property organizationId
   *
   * @description
   * The organization of the internal token, the current one of the session.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;
  // #endregion
}
