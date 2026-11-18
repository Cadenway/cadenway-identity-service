/**
 * Interface TwoStepVerificationState
 *
 * @description
 * The stored two-step verification of an account (`two_step_verifications`), while it is on.
 */
export interface TwoStepVerificationState {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The account, the key of the row.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sealedSecret
   *
   * @description
   * The TOTP secret of the authenticator app, sealed with the version of its key; never in clear.
   *
   * @type {string}
   * @readonly
   */
  readonly sealedSecret: string;

  /**
   * Property authenticatorConfiguredAt
   *
   * @description
   * When the current authenticator app was confirmed ("Configurée le 3 mars 2026").
   *
   * @type {Date}
   * @readonly
   */
  readonly authenticatorConfiguredAt: Date;

  /**
   * Property lastAcceptedTimeStep
   *
   * @description
   * The time step of the last code of the app accepted, `null` before any; a code of this step or
   * an earlier one is refused.
   *
   * @type {number | null}
   * @readonly
   */
  readonly lastAcceptedTimeStep: number | null;

  /**
   * Property webauthnUserHandle
   *
   * @description
   * The opaque WebAuthn handle of the account, base64url; neither its id nor its address.
   *
   * @type {string}
   * @readonly
   */
  readonly webauthnUserHandle: string;

  /**
   * Property failedAnswers
   *
   * @description
   * Wrong two-step answers in a row, from 0 to 5.
   *
   * @type {number}
   * @readonly
   */
  readonly failedAnswers: number;

  /**
   * Property lockedUntil
   *
   * @description
   * End of the lockout of the two-step answers, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lockedUntil: Date | null;

  /**
   * Property backupCodesGeneratedAt
   *
   * @description
   * When the current backup codes were drawn.
   *
   * @type {Date}
   * @readonly
   */
  readonly backupCodesGeneratedAt: Date;

  /**
   * Property enabledAt
   *
   * @description
   * When two-step verification turned on.
   *
   * @type {Date}
   * @readonly
   */
  readonly enabledAt: Date;
  // #endregion
}
