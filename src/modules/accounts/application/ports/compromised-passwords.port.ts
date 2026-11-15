/**
 * Interface CompromisedPasswords
 *
 * @description
 * The list of compromised passwords a new password must not be in (`auth.password-compromised`).
 * Behind a port because the provenance of the full list is still an open decision
 * (`cw-identity-security`): the adapter of today embeds a short list written for this repository.
 */
export interface CompromisedPasswords {
  // #region Methods
  /**
   * Method includes
   *
   * @description
   * Whether a password is in the list.
   *
   * @param {string} password - The password as typed; never logged, never kept.
   * @returns {Promise<boolean>} Whether it is compromised.
   */
  includes(password: string): Promise<boolean>;
  // #endregion
}
