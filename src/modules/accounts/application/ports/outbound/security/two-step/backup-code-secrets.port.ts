/**
 * Interface BackupCodeSecrets
 *
 * @description
 * The backup codes: drawn with `node:crypto`, kept as HMAC-SHA-256 under a key derived from the
 * pepper, bound to the account.
 */
export interface BackupCodeSecrets {
  // #region Methods
  /**
   * Method generate
   *
   * @description
   * Draws the 10 codes of a generation.
   *
   * @returns {string[]} 10 codes `XXXX-XXXX` of `[0-9A-Z]`.
   */
  generate(): string[];

  /**
   * Method hashOf
   *
   * @description
   * The keyed hash of a code of the account, read upper-cased and without its dash.
   *
   * @param {string} userId - The account.
   * @param {string} code - The code, as generated or as answered.
   * @returns {string | null} The hash, or `null` for a code that is not 8 characters of `[0-9A-Za-z]`.
   */
  hashOf(userId: string, code: string): string | null;
  // #endregion
}
