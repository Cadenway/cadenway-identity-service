import { createHmac, hkdfSync, randomInt } from 'node:crypto';

import type { BackupCodeSecrets } from '../../../application/ports/outbound/security/two-step/backup-code-secrets.port.js';

/**
 * Constant KEY_INFO
 *
 * @description
 * The HKDF-SHA-256 label of the key of the backup code hashes.
 *
 * @type {string}
 */
const KEY_INFO: string = 'cadenway identity-service backup codes v1';

/**
 * Constant ALPHABET
 *
 * @description
 * The 36 symbols of a backup code, `[0-9A-Z]` (`BackupCodes.codes` of the contract).
 *
 * @type {string}
 */
const ALPHABET: string = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Constant ANSWER
 *
 * @description
 * A code as an answer may carry it: 8 alphanumerics, with or without the dash.
 *
 * @type {RegExp}
 */
const ANSWER: RegExp = /^[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}$/u;

/**
 * Class HmacBackupCodeSecrets
 *
 * @description
 * `BackupCodeSecrets` with `node:crypto` (decision 7 of P2c): 10 codes `XXXX-XXXX`, each symbol
 * drawn with `randomInt` (no modulo bias) from 36, so 8 × log2(36) ≈ 41.4 bits per code; kept as
 * HMAC-SHA-256 of the account and the code under a key derived from `PASSWORD_PEPPER` by
 * HKDF-SHA-256, so the database alone does not let them be guessed offline. An answer is read
 * upper-cased and without its dash.
 */
export class HmacBackupCodeSecrets implements BackupCodeSecrets {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The key of the hashes, derived once.
   *
   * @type {Buffer}
   * @readonly
   */
  private readonly key: Buffer;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Derives the key of the hashes from the pepper.
   *
   * @param {string} pepper - `PASSWORD_PEPPER`.
   * @constructor
   */
  public constructor(pepper: string) {
    this.key = Buffer.from(hkdfSync('sha256', pepper, '', KEY_INFO, 32));
  }
  // #endregion

  // #region Methods
  /**
   * Method generate
   *
   * @description
   * Draws 10 codes.
   *
   * @returns {string[]} The codes `XXXX-XXXX`.
   */
  public generate(): string[] {
    return Array.from({ length: 10 }, (): string => {
      const symbols: string = Array.from({ length: 8 }, (): string =>
        ALPHABET.charAt(randomInt(0, ALPHABET.length)),
      ).join('');
      return `${symbols.slice(0, 4)}-${symbols.slice(4)}`;
    });
  }

  /**
   * Method hashOf
   *
   * @description
   * The keyed hash of a code of the account.
   *
   * @param {string} userId - The account.
   * @param {string} code - The code.
   * @returns {string | null} The hash, or `null` for a malformed code.
   */
  public hashOf(userId: string, code: string): string | null {
    if (!ANSWER.test(code)) {
      return null;
    }
    const normalized: string = code.replace('-', '').toUpperCase();
    return createHmac('sha256', this.key).update(`${userId}\n${normalized}`).digest('hex');
  }
  // #endregion
}
