import { createHmac, hkdfSync, randomInt } from 'node:crypto';

import type { CodeSubject } from '../../../application/models/authentication/code-subject.model.js';
import type { OneTimeCodeSecrets } from '../../../application/ports/outbound/security/authentication/one-time-code-secrets.port.js';

/**
 * Constant KEY_INFO
 *
 * @description
 * The HKDF context of the code key: it separates it from the use of the pepper by argon2id.
 *
 * @type {string}
 */
const KEY_INFO: string = 'cadenway identity-service one-time codes v1';

/**
 * Class HmacOneTimeCodeSecrets
 *
 * @description
 * `OneTimeCodeSecrets` with `node:crypto` only (`cw-identity-security`, "Primitives"): codes drawn
 * with `crypto.randomInt`, uniform over 000000 to 999999, and hashed with HMAC-SHA-256 under a key
 * derived from `PASSWORD_PEPPER` by HKDF-SHA-256. The hash binds the account and the purpose, and the
 * key never sits in the database, so a copy of the table does not give the codes back by trying the
 * million values.
 */
export class HmacOneTimeCodeSecrets implements OneTimeCodeSecrets {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The HMAC key; never logged.
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
   * Derives the key of the code hashes from the pepper.
   *
   * @param {string} pepper - The value of `PASSWORD_PEPPER`.
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
   * Draws a code of 6 digits.
   *
   * @returns {string} The code, leading zeros kept.
   */
  public generate(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /**
   * Method hash
   *
   * @description
   * The HMAC-SHA-256 of the account, the purpose and the code, as hexadecimal.
   *
   * @param {CodeSubject} subject - The code and what it is for.
   * @returns {string} The hash.
   */
  public hash(subject: CodeSubject): string {
    return createHmac('sha256', this.key)
      .update(`${subject.userId}\n${subject.purpose}\n${subject.code}`)
      .digest('hex');
  }
  // #endregion
}
