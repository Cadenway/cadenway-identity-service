/**
 * Interface OrganizationChoiceRepository
 *
 * @description
 * The last organization each account chose, where its next sessions start (P2b plan, decision 2),
 * bound to the transaction of a unit of work. Every read names the account.
 */
export interface OrganizationChoiceRepository {
  // #region Methods
  /**
   * Method find
   *
   * @description
   * The last organization the account chose.
   *
   * @param {string} userId - The account.
   * @returns {Promise<string | null>} The organization, or `null` when the account never chose one.
   */
  find(userId: string): Promise<string | null>;

  /**
   * Method remember
   *
   * @description
   * Records the organization the account has just chosen, replacing the previous one.
   *
   * @param {string} userId - The account.
   * @param {string} organizationId - The organization.
   * @returns {Promise<void>} Resolves once written.
   */
  remember(userId: string, organizationId: string): Promise<void>;

  /**
   * Method erase
   *
   * @description
   * Deletes the last choice of a deleted account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  erase(userId: string): Promise<void>;
  // #endregion
}
