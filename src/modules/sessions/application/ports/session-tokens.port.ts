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

/**
 * Interface SessionTokens
 *
 * @description
 * Draws session tokens (256 random bits) and hashes the ones presented (`cw-identity-security`).
 */
export interface SessionTokens {
  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws a new token from a cryptographic source.
   *
   * @returns {IssuedToken} The token and its hash.
   */
  issue(): IssuedToken;

  /**
   * Method hashOf
   *
   * @description
   * Hashes a presented token, or refuses a value that cannot be a token of this service, which is
   * then inactive without a lookup.
   *
   * @param {string} token - The value of the cookie.
   * @returns {string | null} Its hash, or `null` when it is malformed.
   */
  hashOf(token: string): string | null;
  // #endregion
}
