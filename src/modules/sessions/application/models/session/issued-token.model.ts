/**
 * Interface IssuedToken
 *
 * @description
 * A new session token and the hash this service keeps of it.
 */
export interface IssuedToken {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The opaque token, returned once to the gateway. A secret.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property tokenHash
   *
   * @description
   * SHA-256 of the token, as hexadecimal: what is stored and looked up.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;
  // #endregion
}
