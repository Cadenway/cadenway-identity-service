import { createHash, randomBytes } from 'node:crypto';

import type { IssuedToken, SessionTokens } from '../../application/ports/session-tokens.port.js';

/**
 * Constant TOKEN_FORMAT
 *
 * @description
 * A token of this service: 32 bytes in unpadded base64url, 43 characters.
 *
 * @type {RegExp}
 */
const TOKEN_FORMAT: RegExp = /^[A-Za-z0-9_-]{43}$/u;

/**
 * Function sha256
 *
 * @description
 * SHA-256 of a token, as hexadecimal.
 *
 * @param {string} token - The token.
 * @returns {string} Its hash.
 */
function sha256(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Class RandomSessionTokens
 *
 * @description
 * `SessionTokens` with `node:crypto` (`cw-identity-security`): an opaque token of 256 random bits,
 * of which only the SHA-256 is stored. A fast unkeyed hash is enough here, unlike for passwords and
 * codes: 256 random bits cannot be guessed from their hash.
 */
export class RandomSessionTokens implements SessionTokens {
  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws a token.
   *
   * @returns {IssuedToken} The token and its hash.
   */
  public issue(): IssuedToken {
    const token: string = randomBytes(32).toString('base64url');
    return { token, tokenHash: sha256(token) };
  }

  /**
   * Method hashOf
   *
   * @description
   * Hashes a presented token, or refuses one that is not 43 base64url characters.
   *
   * @param {string} token - The value of the cookie.
   * @returns {string | null} Its hash, or `null` when it is malformed.
   */
  public hashOf(token: string): string | null {
    return TOKEN_FORMAT.test(token) ? sha256(token) : null;
  }
  // #endregion
}
