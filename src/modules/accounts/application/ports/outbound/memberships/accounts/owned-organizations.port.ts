/**
 * Interface OwnedOrganizations
 *
 * @description
 * The organizations a person owns in the copy of the memberships, owned by the accounts module: an
 * owner cannot delete the account (`409 account.organization-owner`). Joins the system transaction
 * of the use case.
 */
export interface OwnedOrganizations {
  // #region Methods
  /**
   * Method find
   *
   * @description
   * Lists the organizations whose active membership of the person has the role `owner`.
   *
   * @param {string} userId - The person.
   * @returns {Promise<readonly string[]>} Their ids, empty when the person owns none.
   */
  find(userId: string): Promise<readonly string[]>;
  // #endregion
}
