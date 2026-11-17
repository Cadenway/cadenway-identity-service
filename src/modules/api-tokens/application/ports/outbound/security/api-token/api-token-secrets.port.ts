import type { IssuedApiToken } from '../../../../models/api-token/issued-api-token.model.js';

/**
 * Interface ApiTokenSecrets
 *
 * @description
 * Draws the secrets of personal API tokens and hashes the ones presented (`cw-identity-security`).
 */
export interface ApiTokenSecrets {
  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws a new secret from a cryptographic source.
   *
   * @returns {IssuedApiToken} The secret, its prefix and its hash.
   */
  issue(): IssuedApiToken;

  /**
   * Method hashOf
   *
   * @description
   * Hashes a presented secret, or refuses a value that cannot be a secret of this service (wrong
   * format or check characters), which is then inactive without a lookup.
   *
   * @param {string} token - The bearer token.
   * @returns {string | null} Its hash, or `null` when it is malformed.
   */
  hashOf(token: string): string | null;
  // #endregion
}
