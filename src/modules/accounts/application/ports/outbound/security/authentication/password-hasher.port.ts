/**
 * Interface PasswordHasher
 *
 * @description
 * Hashes and checks passwords (argon2id with the pepper, `cw-identity-security`). A password never
 * leaves the hasher in any other form than its encoded hash.
 */
export interface PasswordHasher {
  // #region Methods
  /**
   * Method hash
   *
   * @description
   * Hashes a password with a fresh salt.
   *
   * @param {string} password - The password as typed.
   * @returns {Promise<string>} The encoded hash, with its algorithm, parameters and salt.
   */
  hash(password: string): Promise<string>;

  /**
   * Method verify
   *
   * @description
   * Checks a password against an encoded hash. Without a hash, it still runs one hash computation
   * and resolves `false`, so the time of a sign-in does not tell whether an account uses the
   * address.
   *
   * @param {string} password - The password as typed.
   * @param {string | null} passwordHash - The stored encoded hash, or `null` when there is none.
   * @returns {Promise<boolean>} Whether the password is the one of the hash.
   */
  verify(password: string, passwordHash: string | null): Promise<boolean>;
  // #endregion
}
