/**
 * Interface AuthenticatorAppSetupView
 *
 * @description
 * The secret of a new authenticator app, returned once (`AuthenticatorAppSetup` of the contract).
 */
export interface AuthenticatorAppSetupView {
  // #region Properties
  /**
   * Property secret
   *
   * @description
   * The TOTP secret, base32. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly secret: string;

  /**
   * Property otpauthUri
   *
   * @description
   * Its `otpauth://totp/` URI, issuer `Cadenway`. A secret, never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly otpauthUri: string;

  /**
   * Property expiresAt
   *
   * @description
   * 15 minutes after the start.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}
