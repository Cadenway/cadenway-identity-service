/**
 * Interface PendingTwoStepStart
 *
 * @description
 * A started change of two-step verification waiting for its completion: the setup of an
 * authenticator app (its sealed secret, 15 minutes) or the registration of a security key (its
 * WebAuthn challenge, 5 minutes). It belongs to the session that started it ("The pending setup
 * belongs to this session"): only that session, while it is open, completes it, before `expiresAt`;
 * a new start replaces it.
 */
export interface PendingTwoStepStart {
  // #region Properties
  /**
   * Property sessionId
   *
   * @description
   * The session that started it.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property value
   *
   * @description
   * The sealed secret of the app, or the WebAuthn challenge of the key. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property expiresAt
   *
   * @description
   * When it can no longer be completed.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}
