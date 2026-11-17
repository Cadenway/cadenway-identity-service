/**
 * Interface AccountApiTokens
 *
 * @description
 * What the deletion of an account asks of the api-tokens module, owned by the accounts module. Each
 * call joins the system transaction of the use case.
 */
export interface AccountApiTokens {
  // #region Methods
  /**
   * Method revokeAll
   *
   * @description
   * Revokes every personal API token of a person, in every organization.
   *
   * @param {string} userId - The person.
   * @returns {Promise<number>} The tokens revoked.
   */
  revokeAll(userId: string): Promise<number>;

  /**
   * Method erase
   *
   * @description
   * Deletes every personal API token of a deleted account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  erase(userId: string): Promise<void>;
  // #endregion
}
