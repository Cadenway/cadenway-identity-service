import { createHash, randomBytes } from 'node:crypto';

import type { IssuedResetToken } from '../../../application/models/password-reset/issued-reset-token.model.js';
import type { ResetLinkSecrets } from '../../../application/ports/outbound/security/password-reset/reset-link-secrets.port.js';

/**
 * Constant TOKEN_BYTES
 *
 * @description
 * Random bytes of a token: 256 bits, like a session token.
 *
 * @type {number}
 */
const TOKEN_BYTES: number = 32;

/**
 * Constant TOKEN_PATTERN
 *
 * @description
 * The form of a token this service draws: 32 bytes in base64url without padding, 43 characters
 * (within the `^[A-Za-z0-9_-]{32,128}$` of `password-reset-link.issued.v1`).
 *
 * @type {RegExp}
 */
const TOKEN_PATTERN: RegExp = /^[A-Za-z0-9_-]{43}$/u;

/**
 * Class RandomResetLinkSecrets
 *
 * @description
 * `ResetLinkSecrets` on `node:crypto`: a token of 256 random bits in base64url, which travels after
 * `#token=` in the link, and its SHA-256 in hexadecimal, which is stored. A token of 256 random bits
 * cannot be recovered from its hash, so no key is needed, as for the session tokens
 * (`cw-identity-security`).
 */
export class RandomResetLinkSecrets implements ResetLinkSecrets {
  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws a new token.
   *
   * @returns {IssuedResetToken} The token and its hash.
   */
  public issue(): IssuedResetToken {
    const token: string = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, tokenHash: RandomResetLinkSecrets.hash(token) };
  }

  /**
   * Method hashOf
   *
   * @description
   * Hashes a token sent back, or refuses one that cannot be a token of this service without a
   * lookup.
   *
   * @param {string} token - The token, as the request carried it.
   * @returns {string | null} Its hash, or `null` when malformed.
   */
  public hashOf(token: string): string | null {
    return TOKEN_PATTERN.test(token) ? RandomResetLinkSecrets.hash(token) : null;
  }

  /**
   * Method hash
   *
   * @description
   * SHA-256 of a token, in hexadecimal.
   *
   * @param {string} token - The token.
   * @returns {string} Its hash.
   */
  private static hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
  // #endregion
}
