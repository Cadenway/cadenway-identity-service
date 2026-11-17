/**
 * Interface RevokeOtherSessionsInput
 *
 * @description
 * "Déconnecter les autres" from the session of the request.
 */
export interface RevokeOtherSessionsInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The person, from the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the request, which stays open.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}
