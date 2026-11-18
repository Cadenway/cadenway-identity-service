import type { IssuedChallengeToken } from '../../../../models/two-step/issued-challenge-token.model.js';

/**
 * Interface ChallengeTokens
 *
 * @description
 * The tokens of the two-step challenges: 256 random bits, kept as their SHA-256.
 */
export interface ChallengeTokens {
  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws a new token.
   *
   * @returns {IssuedChallengeToken} The token and its hash.
   */
  issue(): IssuedChallengeToken;

  /**
   * Method hashOf
   *
   * @description
   * The hash of a token as a request carried it.
   *
   * @param {string} token - The token.
   * @returns {string | null} Its hash, or `null` for a malformed token.
   */
  hashOf(token: string): string | null;
  // #endregion
}
