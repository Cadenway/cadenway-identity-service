/**
 * Interface AuthenticatorAppSecrets
 *
 * @description
 * The secrets of the authenticator apps: drawn with `node:crypto`, sealed at rest under a key
 * derived from the pepper and bound to the account.
 */
export interface AuthenticatorAppSecrets {
  // #region Methods
  /**
   * Method generate
   *
   * @description
   * Draws a new TOTP secret of 160 random bits.
   *
   * @returns {string} The secret, base32 without padding (32 characters).
   */
  generate(): string;

  /**
   * Method seal
   *
   * @description
   * Seals a secret for the account, with the version of the key.
   *
   * @param {string} userId - The account it belongs to.
   * @param {string} secret - The secret, base32.
   * @returns {string} The sealed secret, to store.
   */
  seal(userId: string, secret: string): string;

  /**
   * Method open
   *
   * @description
   * Opens a sealed secret of the account.
   *
   * @param {string} userId - The account it belongs to.
   * @param {string} sealed - The stored sealed secret.
   * @returns {string} The secret, base32; throws for a secret of another account, an unknown key or a tampered value.
   */
  open(userId: string, sealed: string): string;
  // #endregion
}
