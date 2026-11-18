import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

import type { AuthenticatorAppSecrets } from '../../../application/ports/outbound/security/two-step/authenticator-app-secrets.port.js';

/**
 * Constant KEY_VERSION
 *
 * @description
 * The version of the sealing key, stored at the head of every sealed secret, so that a later
 * rotation can tell the secrets sealed under each key (see the accounts `MODULE.md`).
 *
 * @type {string}
 */
const KEY_VERSION: string = 'k1';

/**
 * Constant NONCE_BYTES
 *
 * @description
 * The length of the nonce of AES-256-GCM, 96 bits, drawn for every seal.
 *
 * @type {number}
 */
const NONCE_BYTES: number = 12;

/**
 * Constant TAG_BYTES
 *
 * @description
 * The length of the authentication tag, 128 bits: a shorter stored tag is refused rather than
 * checked, so a truncated tag cannot make a forgery easier.
 *
 * @type {number}
 */
const TAG_BYTES: number = 16;

/**
 * Constant KEY_INFO
 *
 * @description
 * The HKDF-SHA-256 label of the sealing key of version `k1`, apart from the labels of the password
 * secret, of the code hashes and of the backup code hashes.
 *
 * @type {string}
 */
const KEY_INFO: string = 'cadenway identity-service authenticator apps v1';

/**
 * Constant BASE32_ALPHABET
 *
 * @description
 * The RFC 4648 base32 alphabet the authenticator apps read.
 *
 * @type {string}
 */
const BASE32_ALPHABET: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Function base32
 *
 * @description
 * Encodes bytes in RFC 4648 base32 without padding: 20 bytes give 32 characters.
 *
 * @param {Uint8Array} bytes - The bytes.
 * @returns {string} The encoding.
 */
function base32(bytes: Uint8Array): string {
  let bits: number = 0;
  let value: number = 0;
  let output: string = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET.charAt((value << (5 - bits)) & 31);
  }
  return output;
}

/**
 * Class AesAuthenticatorAppSecrets
 *
 * @description
 * `AuthenticatorAppSecrets` with `node:crypto` (decision 7 of P2c, `cw-identity-security`): a new
 * secret is 160 random bits in base32; it is sealed with AES-256-GCM under a key derived from
 * `PASSWORD_PEPPER` by HKDF-SHA-256 (label above), a random 96-bit nonce and the id of the account
 * as additional data, so a sealed secret copied to another account does not open. The envelope is
 * `k1.<nonce>.<ciphertext>.<tag>` in base64url. Changing the pepper makes every sealed secret
 * unusable; a rotation adds a key `k2`, opens both and seals with the new one.
 */
export class AesAuthenticatorAppSecrets implements AuthenticatorAppSecrets {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The sealing key of version `k1`, derived once.
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
   * Derives the sealing key from the pepper.
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
   * Draws 20 random bytes and encodes them in base32.
   *
   * @returns {string} The secret.
   */
  public generate(): string {
    return base32(randomBytes(20));
  }

  /**
   * Method seal
   *
   * @description
   * Encrypts the secret for the account.
   *
   * @param {string} userId - The account.
   * @param {string} secret - The secret.
   * @returns {string} The envelope.
   */
  public seal(userId: string, secret: string): string {
    const nonce: Buffer = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(userId, 'utf8'));
    const ciphertext: Buffer = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [
      KEY_VERSION,
      nonce.toString('base64url'),
      ciphertext.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
    ].join('.');
  }

  /**
   * Method open
   *
   * @description
   * Decrypts a sealed secret of the account.
   *
   * @param {string} userId - The account.
   * @param {string} sealed - The envelope.
   * @returns {string} The secret.
   * @throws {Error} For an unknown key version, a malformed envelope, or a secret that does not
   * authenticate (another account, another key, a tampered value); the message holds no value.
   */
  public open(userId: string, sealed: string): string {
    const [version, nonce, ciphertext, tag] = sealed.split('.');
    if (
      version !== KEY_VERSION ||
      nonce === undefined ||
      ciphertext === undefined ||
      tag === undefined
    ) {
      throw new Error('The sealed secret of the authenticator app has an unknown form.');
    }
    const nonceBytes: Buffer = Buffer.from(nonce, 'base64url');
    const tagBytes: Buffer = Buffer.from(tag, 'base64url');
    if (nonceBytes.length !== NONCE_BYTES || tagBytes.length !== TAG_BYTES) {
      throw new Error('The sealed secret of the authenticator app has an unknown form.');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, nonceBytes, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(userId, 'utf8'));
    decipher.setAuthTag(tagBytes);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
  // #endregion
}
