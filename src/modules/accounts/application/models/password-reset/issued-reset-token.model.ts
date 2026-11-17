/**
 * Interface IssuedResetToken
 *
 * @description
 * The token of a new password reset link and the hash this service keeps of it.
 */
export interface IssuedResetToken {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The secret of the link, base64url. Travels in the restricted event only; never logged, never
   * stored.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property tokenHash
   *
   * @description
   * SHA-256 of the token, in hexadecimal: what is stored.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;
  // #endregion
}
