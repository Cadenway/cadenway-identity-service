/**
 * Interface RevokeSessionInput
 *
 * @description
 * Who revokes which session.
 */
export interface RevokeSessionInput {
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
  // #endregion
}
