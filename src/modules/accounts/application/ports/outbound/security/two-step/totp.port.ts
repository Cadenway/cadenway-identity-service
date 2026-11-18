/**
 * Interface Totp
 *
 * @description
 * The time-based codes of the authenticator apps (RFC 6238: SHA-1, 6 digits, 30-second steps, one
 * step of tolerance either way).
 */
export interface Totp {
  // #region Methods
  /**
   * Method verify
   *
   * @description
   * Checks a code against a secret at an instant, refusing a time step at or before the last one
   * accepted, so a code is accepted once.
   *
   * @param {string} secret - The secret, base32.
   * @param {string} code - The 6 digits.
   * @param {Date} at - The instant of the answer.
   * @param {number | null} afterTimeStep - The last time step accepted, `null` for none.
   * @returns {Promise<number | null>} The time step of the code, or `null` for a wrong or used one.
   */
  verify(
    secret: string,
    code: string,
    at: Date,
    afterTimeStep: number | null,
  ): Promise<number | null>;

  /**
   * Method uriOf
   *
   * @description
   * The `otpauth://totp/` URI an app scans, issuer `Cadenway`.
   *
   * @param {string} secret - The secret, base32.
   * @param {string} accountName - The address of the account, its label.
   * @returns {string} The URI.
   */
  uriOf(secret: string, accountName: string): string;
  // #endregion
}
