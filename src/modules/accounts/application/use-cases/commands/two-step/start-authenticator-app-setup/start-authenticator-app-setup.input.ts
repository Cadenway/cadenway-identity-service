/**
 * Interface StartAuthenticatorAppSetupInput
 *
 * @description
 * The start of the setup of an authenticator app (`POST
 * /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup`).
 */
export interface StartAuthenticatorAppSetupInput {
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
   * Property userId
   *
   * @description
   * The account of the path.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the public request, which the pending setup belongs to.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}
