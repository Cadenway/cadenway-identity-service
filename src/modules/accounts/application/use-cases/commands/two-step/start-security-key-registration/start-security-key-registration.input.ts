/**
 * Interface StartSecurityKeyRegistrationInput
 *
 * @description
 * The start of the registration of a security key.
 */
export interface StartSecurityKeyRegistrationInput {
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
   * The session of the public request, which the pending registration belongs to.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}
