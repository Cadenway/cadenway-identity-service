import { argon2, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Argon2Parameters } from 'node:crypto';

import type { PasswordHasher } from '../../application/ports/password-hasher.port.js';

/**
 * Interface Argon2Cost
 *
 * @description
 * The cost parameters of argon2id, stored in each encoded hash so that a later change of the
 * parameters still verifies the passwords hashed before it.
 */
interface Argon2Cost {
  // #region Properties
  /**
   * Property memory
   *
   * @description
   * Memory, in KiB.
   *
   * @type {number}
   * @readonly
   */
  readonly memory: number;

  /**
   * Property passes
   *
   * @description
   * Number of passes over the memory.
   *
   * @type {number}
   * @readonly
   */
  readonly passes: number;

  /**
   * Property parallelism
   *
   * @description
   * Degree of parallelism.
   *
   * @type {number}
   * @readonly
   */
  readonly parallelism: number;
  // #endregion
}

/**
 * Constant COST
 *
 * @description
 * The parameters of `cw-identity-security`: m = 19 456 KiB, t = 2, p = 1 (the OWASP baseline for
 * argon2id).
 *
 * @type {Argon2Cost}
 */
const COST: Argon2Cost = { memory: 19_456, passes: 2, parallelism: 1 };

/**
 * Constant SALT_BYTES
 *
 * @description
 * Length of the random salt of each hash.
 *
 * @type {number}
 */
const SALT_BYTES: number = 16;

/**
 * Constant SECRET_INFO
 *
 * @description
 * The HKDF context of the argon2 secret key: it separates it from the key of the code hashes, both
 * derived from `PASSWORD_PEPPER`.
 *
 * @type {string}
 */
const SECRET_INFO: string = 'cadenway identity-service password hashing v1';

/**
 * Constant TAG_BYTES
 *
 * @description
 * Length of the derived hash.
 *
 * @type {number}
 */
const TAG_BYTES: number = 32;

/**
 * Constant ENCODED_HASH
 *
 * @description
 * The PHC string format of an argon2id hash, version 1.3 (19): parameters, salt and hash in
 * unpadded base64. The pepper is not in it.
 *
 * @type {RegExp}
 */
const ENCODED_HASH: RegExp =
  /^\$argon2id\$v=19\$m=(\d{1,7}),t=(\d{1,2}),p=(\d{1,2})\$([A-Za-z0-9+/]{11,})\$([A-Za-z0-9+/]{11,})$/u;

/**
 * Function derive
 *
 * @description
 * Runs argon2id on the thread pool of libuv (`crypto.argon2` of Node), never on the event loop.
 *
 * @param {Argon2Parameters} parameters - Message, salt, secret and cost.
 * @returns {Promise<Buffer>} The derived hash.
 */
async function derive(parameters: Argon2Parameters): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    argon2('argon2id', parameters, (error: Error | null, derivedKey: Buffer) => {
      if (error === null) {
        resolve(derivedKey);
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Function base64
 *
 * @description
 * Unpadded base64, as the PHC string format writes it.
 *
 * @param {Buffer} bytes - The bytes to encode.
 * @returns {string} Their unpadded base64.
 */
function base64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/u, '');
}

/**
 * Class Argon2PasswordHasher
 *
 * @description
 * `PasswordHasher` with argon2id through `crypto.argon2` of Node, with no third-party binary
 * (`cw-identity-security`). The secret key of argon2 (its `K` input) is derived from the pepper by
 * HKDF-SHA-256 under its own label, apart from the key of the code hashes: the pepper never sits in
 * the database, so a copy of the table alone cannot be attacked offline. The password is normalized
 * to NFC first, so the same password typed on two keyboards hashes alike.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  // #region Properties
  /**
   * Property secret
   *
   * @description
   * The secret key of argon2, derived from `PASSWORD_PEPPER`; never logged.
   *
   * @type {Buffer}
   * @readonly
   */
  private readonly secret: Buffer;

  /**
   * Property decoy
   *
   * @description
   * A hash of a random password, started when the hasher is built, that `verify` checks when there
   * is no hash, so a missing account costs the same time as a wrong password from the first
   * sign-in on. A failed computation is dropped and started again on the next use.
   *
   * @type {Promise<string> | undefined}
   */
  private decoy: Promise<string> | undefined;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Derives the secret key of argon2 from the pepper and starts the decoy hash.
   *
   * @param {string} pepper - The value of `PASSWORD_PEPPER`.
   * @constructor
   */
  public constructor(pepper: string) {
    this.secret = Buffer.from(hkdfSync('sha256', pepper, '', SECRET_INFO, 32));
    this.decoy = this.startDecoy();
    this.decoy.catch(() => undefined);
  }
  // #endregion

  // #region Methods
  /**
   * Method hash
   *
   * @description
   * Hashes a password with a fresh 16-byte salt.
   *
   * @param {string} password - The password as typed.
   * @returns {Promise<string>} The PHC string of the hash.
   */
  public async hash(password: string): Promise<string> {
    const salt: Buffer = randomBytes(SALT_BYTES);
    const tag: Buffer = await this.derive(password, salt, COST);
    return `$argon2id$v=19$m=${String(COST.memory)},t=${String(COST.passes)},p=${String(
      COST.parallelism,
    )}$${base64(salt)}$${base64(tag)}`;
  }

  /**
   * Method verify
   *
   * @description
   * Recomputes the hash with the salt and the parameters of the encoded one and compares in
   * constant time. A missing or malformed hash checks the decoy and resolves `false`.
   *
   * @param {string} password - The password as typed.
   * @param {string | null} passwordHash - The stored PHC string, or `null`.
   * @returns {Promise<boolean>} Whether the password matches.
   */
  public async verify(password: string, passwordHash: string | null): Promise<boolean> {
    const encoded: RegExpExecArray | null =
      passwordHash === null ? null : ENCODED_HASH.exec(passwordHash);
    if (encoded === null) {
      this.decoy ??= this.startDecoy();
      const decoy: RegExpExecArray | null = ENCODED_HASH.exec(await this.decoy);
      if (decoy !== null) {
        await this.compare(password, decoy);
      }
      return false;
    }
    return this.compare(password, encoded);
  }

  /**
   * Method startDecoy
   *
   * @description
   * Hashes a random password for the decoy; a failure clears it so the next use starts again.
   *
   * @returns {Promise<string>} The PHC string of the decoy.
   */
  private startDecoy(): Promise<string> {
    return this.hash(randomBytes(SALT_BYTES).toString('base64')).catch((error: unknown) => {
      this.decoy = undefined;
      throw error;
    });
  }

  /**
   * Method compare
   *
   * @description
   * Compares a password with a parsed PHC string.
   *
   * @param {string} password - The password as typed.
   * @param {RegExpExecArray} encoded - The match of `ENCODED_HASH`.
   * @returns {Promise<boolean>} Whether the password matches.
   */
  private async compare(password: string, encoded: RegExpExecArray): Promise<boolean> {
    const [, memory, passes, parallelism, salt, tag]: (string | undefined)[] = encoded;
    if (
      memory === undefined ||
      passes === undefined ||
      parallelism === undefined ||
      salt === undefined ||
      tag === undefined
    ) {
      return false;
    }
    const expected: Buffer = Buffer.from(tag, 'base64');
    const actual: Buffer = await this.derive(password, Buffer.from(salt, 'base64'), {
      memory: Number(memory),
      passes: Number(passes),
      parallelism: Number(parallelism),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  /**
   * Method derive
   *
   * @description
   * Runs argon2id on a normalized password with the pepper as its secret.
   *
   * @param {string} password - The password as typed.
   * @param {Buffer} salt - The salt.
   * @param {Argon2Cost} cost - The parameters.
   * @returns {Promise<Buffer>} The 32-byte hash.
   */
  private async derive(password: string, salt: Buffer, cost: Argon2Cost): Promise<Buffer> {
    return derive({
      message: password.normalize('NFC'),
      nonce: salt,
      secret: this.secret,
      memory: cost.memory,
      passes: cost.passes,
      parallelism: cost.parallelism,
      tagLength: TAG_BYTES,
    });
  }
  // #endregion
}
