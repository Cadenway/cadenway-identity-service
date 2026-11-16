/**
 * Interface PasswordCredentialRepository
 *
 * @description
 * The password hash of each account, bound to the transaction of a unit of work.
 */
export interface PasswordCredentialRepository {
  // #region Methods
  /**
   * Method findHash
   *
   * @description
   * Reads the encoded hash of the password of an account.
   *
   * @param {string} userId - Id of the account.
   * @returns {Promise<string | null>} The encoded hash, or `null` when the account has no password.
   */
  findHash(userId: string): Promise<string | null>;

  /**
   * Method save
   *
   * @description
   * Sets the password hash of an account, replacing the previous one.
   *
   * @param {string} userId - Id of the account.
   * @param {string} passwordHash - The encoded hash.
   * @returns {Promise<void>} Resolves once written.
   */
  save(userId: string, passwordHash: string): Promise<void>;
  // #endregion
}
