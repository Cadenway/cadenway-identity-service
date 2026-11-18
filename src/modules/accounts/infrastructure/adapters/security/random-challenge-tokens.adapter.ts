import { createHash, randomBytes } from 'node:crypto';

import type { IssuedChallengeToken } from '../../../application/models/two-step/issued-challenge-token.model.js';
import type { ChallengeTokens } from '../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';

/**
 * Constant TOKEN_PATTERN
 *
 * @description
 * A token as this adapter draws it: 32 bytes in base64url, 43 characters.
 *
 * @type {RegExp}
 */
const TOKEN_PATTERN: RegExp = /^[A-Za-z0-9_-]{43}$/u;

/**
 * Class RandomChallengeTokens
 *
 * @description
 * `ChallengeTokens` with `node:crypto`: 256 random bits in base64url, hashed with SHA-256 without a
 * key, like a session token: they cannot be recovered from their hash. A malformed token is
 * refused without a lookup.
 */
export class RandomChallengeTokens implements ChallengeTokens {
  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws a token and hashes it.
   *
   * @returns {IssuedChallengeToken} The token and its hash.
   */
  public issue(): IssuedChallengeToken {
    const token: string = randomBytes(32).toString('base64url');
    return { token, tokenHash: createHash('sha256').update(token, 'utf8').digest('hex') };
  }

  /**
   * Method hashOf
   *
   * @description
   * Hashes a token a request carried.
   *
   * @param {string} token - The token.
   * @returns {string | null} Its hash, or `null` for a malformed token.
   */
  public hashOf(token: string): string | null {
    return TOKEN_PATTERN.test(token)
      ? createHash('sha256').update(token, 'utf8').digest('hex')
      : null;
  }
  // #endregion
}
