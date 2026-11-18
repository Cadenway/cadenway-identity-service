/**
 * Interface BackupCodeRepository
 *
 * @description
 * The backup codes of the accounts (`backup_codes`), kept as keyed hashes.
 */
export interface BackupCodeRepository {
  // #region Methods
  /**
   * Method replaceAll
   *
   * @description
   * Replaces the codes of an account with new ones, which stop the previous ones at once.
   *
   * @param {string} userId - The account.
   * @param {readonly string[]} codeHashes - The hashes of the new codes.
   * @returns {Promise<void>} Resolves once written.
   */
  replaceAll(userId: string, codeHashes: readonly string[]): Promise<void>;

  /**
   * Method countUnused
   *
   * @description
   * Counts the codes of an account not used yet.
   *
   * @param {string} userId - The account.
   * @returns {Promise<number>} Its unused codes.
   */
  countUnused(userId: string): Promise<number>;

  /**
   * Method use
   *
   * @description
   * Uses an unused code of the account up, once: a concurrent use of the same code finds it used.
   *
   * @param {string} userId - The account.
   * @param {string} codeHash - The hash of the code answered.
   * @param {Date} now - When it is used.
   * @returns {Promise<boolean>} `true` when an unused code of the account had this hash.
   */
  use(userId: string, codeHash: string, now: Date): Promise<boolean>;

  /**
   * Method deleteOfUser
   *
   * @description
   * Deletes every code of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  deleteOfUser(userId: string): Promise<void>;
  // #endregion
}
