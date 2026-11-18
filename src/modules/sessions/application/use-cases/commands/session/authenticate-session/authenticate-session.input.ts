/**
 * Interface AuthenticateSessionInput
 *
 * @description
 * The session whose person has just proved who they are.
 */
export interface AuthenticateSessionInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The person, the actor.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}
