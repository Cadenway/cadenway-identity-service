import type { IssuedResetToken } from '../../../../models/password-reset/issued-reset-token.model.js';

/**
 * Interface ResetLinkSecrets
 *
 * @description
 * Draws the tokens of the password reset links and hashes them: only the hash is stored.
 */
export interface ResetLinkSecrets {
  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws a new token from a cryptographic source.
   *
   * @returns {IssuedResetToken} The token and its hash.
   */
  issue(): IssuedResetToken;

  /**
   * Method hashOf
   *
   * @description
   * Hashes a token sent back by a browser, without a lookup for a malformed one.
   *
   * @param {string} token - The token, as the request carried it.
   * @returns {string | null} Its hash, or `null` when it cannot be a token of this service.
   */
  hashOf(token: string): string | null;
  // #endregion
}
