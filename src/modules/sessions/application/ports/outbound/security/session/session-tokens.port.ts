import type { IssuedToken } from '../../../../models/session/issued-token.model.js';

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
