import { createHash, randomInt } from 'node:crypto';
import { crc32 } from 'node:zlib';

import type { IssuedApiToken } from '../../../application/models/api-token/issued-api-token.model.js';
import type { ApiTokenSecrets } from '../../../application/ports/outbound/security/api-token/api-token-secrets.port.js';

/**
 * Constant BASE62
 *
 * @description
 * The 62 characters of a secret, digits first, then upper and lower case letters.
 *
 * @type {string}
 */
const BASE62: string = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Constant PREFIX
 *
 * @description
 * The fixed start of every secret, which tells a personal API token from any other credential.
 *
 * @type {string}
 */
const PREFIX: string = 'cw_pat_';

/**
 * Constant RANDOM_LENGTH
 *
 * @description
 * Random base62 characters of a secret: 30, about 178 bits.
 *
 * @type {number}
 */
const RANDOM_LENGTH: number = 30;

/**
 * Constant CHECK_LENGTH
 *
 * @description
 * Base62 characters of the CRC32 check: 6 hold any 32-bit value (62^6 > 2^32).
 *
 * @type {number}
 */
const CHECK_LENGTH: number = 6;

/**
 * Constant DISPLAY_PREFIX_LENGTH
 *
 * @description
 * Characters of the secret kept to recognize the token in a list (`prefix` of the contract).
 *
 * @type {number}
 */
const DISPLAY_PREFIX_LENGTH: number = 11;

/**
 * Constant SECRET_FORMAT
 *
 * @description
 * A secret of this service: `cw_pat_`, then 36 base62 characters (`ApiTokenCreated.secret`).
 *
 * @type {RegExp}
 */
const SECRET_FORMAT: RegExp = /^cw_pat_[0-9A-Za-z]{36}$/u;

/**
 * Function checkOf
 *
 * @description
 * The CRC32 of the random part of a secret, in 6 base62 characters, zeros first.
 *
 * @param {string} random - The 30 random characters.
 * @returns {string} The check characters.
 */
function checkOf(random: string): string {
  let value: number = crc32(Buffer.from(random, 'ascii'));
  let check: string = '';
  for (let index: number = 0; index < CHECK_LENGTH; index += 1) {
    check = `${BASE62.charAt(value % 62)}${check}`;
    value = Math.floor(value / 62);
  }
  return check;
}

/**
 * Function sha256
 *
 * @description
 * SHA-256 of a secret, as hexadecimal.
 *
 * @param {string} secret - The secret.
 * @returns {string} Its hash.
 */
function sha256(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/**
 * Class RandomApiTokenSecrets
 *
 * @description
 * `ApiTokenSecrets` with `node:crypto` (`cw-identity-security`): `cw_pat_`, 30 base62 characters
 * drawn one by one with `randomInt`, without bias, then 6 base62 characters of the CRC32 of those
 * 30, so that a mistyped or truncated token is refused without a lookup and a secret scanner can
 * recognize one. Only the SHA-256 is stored: a fast unkeyed hash is enough for 178 random bits.
 */
export class RandomApiTokenSecrets implements ApiTokenSecrets {
  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws a secret.
   *
   * @returns {IssuedApiToken} The secret, its prefix and its hash.
   */
  public issue(): IssuedApiToken {
    let random: string = '';
    for (let index: number = 0; index < RANDOM_LENGTH; index += 1) {
      random += BASE62.charAt(randomInt(BASE62.length));
    }
    const secret: string = `${PREFIX}${random}${checkOf(random)}`;
    return {
      secret,
      prefix: secret.slice(0, DISPLAY_PREFIX_LENGTH),
      tokenHash: sha256(secret),
    };
  }

  /**
   * Method hashOf
   *
   * @description
   * Hashes a presented secret, or refuses one of another format or whose check characters do not
   * match.
   *
   * @param {string} token - The bearer token.
   * @returns {string | null} Its hash, or `null` when it is malformed.
   */
  public hashOf(token: string): string | null {
    if (!SECRET_FORMAT.test(token)) {
      return null;
    }
    const random: string = token.slice(PREFIX.length, PREFIX.length + RANDOM_LENGTH);
    const check: string = token.slice(PREFIX.length + RANDOM_LENGTH);
    return checkOf(random) === check ? sha256(token) : null;
  }
  // #endregion
}
