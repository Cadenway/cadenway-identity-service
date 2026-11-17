/**
 * Interface IssuedApiToken
 *
 * @description
 * A new secret, the prefix shown in the lists and the hash this service keeps
 * (`cw-identity-security`).
 */
export interface IssuedApiToken {
  // #region Properties
  /**
   * Property secret
   *
   * @description
   * The token: `cw_pat_`, 30 base62 characters and 6 of CRC32 check. A secret, returned
   * once, never stored nor logged.
   *
   * @type {string}
   * @readonly
   */
  readonly secret: string;

  /**
   * Property prefix
   *
   * @description
   * Its first 11 characters.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;

  /**
   * Property tokenHash
   *
   * @description
   * SHA-256 of the secret, as hexadecimal: what is stored and looked up.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;
  // #endregion
}
