/**
 * Interface ReauthenticateInput
 *
 * @description
 * A signed-in person confirming the password in a session (`POST /v1/auth/reauthentication`).
 */
export interface ReauthenticateInput {
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
   * The session of the request, as the introspection returned it.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property password
   *
   * @description
   * The password of the account; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly password: string;
  // #endregion
}
