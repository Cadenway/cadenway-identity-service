/**
 * Interface ReauthenticateInput
 *
 * @description
 * A signed-in person confirming who they are in a session (`POST /v1/auth/reauthentication`): the
 * password of an account without two-step verification, or a code of the authenticator app of an
 * account with it. The route accepts exactly one of the two.
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
   * The password of the account, `null` with a code; never logged.
   *
   * @type {string | null}
   * @readonly
   */
  readonly password: string | null;

  /**
   * Property code
   *
   * @description
   * The 6 digits of the authenticator app, `null` with a password; never logged.
   *
   * @type {string | null}
   * @readonly
   */
  readonly code: string | null;
  // #endregion
}
