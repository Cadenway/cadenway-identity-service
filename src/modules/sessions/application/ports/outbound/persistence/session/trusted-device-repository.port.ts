/**
 * Interface TrustedDeviceRepository
 *
 * @description
 * The trusted devices of the accounts (`trusted_devices`), known by the SHA-256 of their token.
 */
export interface TrustedDeviceRepository {
  // #region Methods
  /**
   * Method insert
   *
   * @description
   * Records a new trusted device of an account.
   *
   * @param {string} userId - The account.
   * @param {string} tokenHash - The SHA-256 of its token.
   * @param {Date} expiresAt - When it stops being trusted.
   * @returns {Promise<void>} Resolves once written.
   */
  insert(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;

  /**
   * Method isTrusted
   *
   * @description
   * Whether a token hash names a device of this account that is still trusted at `now`.
   *
   * @param {string} userId - The account.
   * @param {string} tokenHash - The SHA-256 of the token.
   * @param {Date} now - The instant of the sign-in.
   * @returns {Promise<boolean>} `true` for a trusted device of the account.
   */
  isTrusted(userId: string, tokenHash: string, now: Date): Promise<boolean>;

  /**
   * Method pruneOfUser
   *
   * @description
   * Deletes the devices of an account that stopped being trusted, and the oldest trusted ones
   * beyond `keep`, so they do not accumulate.
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @param {number} keep - How many trusted devices may stay, the newest first.
   * @returns {Promise<void>} Resolves once deleted.
   */
  pruneOfUser(userId: string, now: Date, keep: number): Promise<void>;

  /**
   * Method deleteOfUser
   *
   * @description
   * Forgets every trusted device of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<number>} How many were forgotten.
   */
  deleteOfUser(userId: string): Promise<number>;
  // #endregion
}
