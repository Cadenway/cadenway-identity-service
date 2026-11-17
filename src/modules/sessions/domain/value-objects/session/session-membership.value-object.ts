/**
 * Interface SessionMembership
 *
 * @description
 * The membership a session acts through: its current organization, chosen with
 * `PUT /internal/v1/sessions/{sessionId}/organization` or inherited at the sign-in from the last
 * choice of the account. The session keeps the membership, not only the organization, so that a
 * removal ends its organization for good: a person who joins again gets a new membership, and the
 * session acts on no organization until it is chosen again (P2b plan, decision 2).
 */
export interface SessionMembership {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The current organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property memberId
   *
   * @description
   * The membership of the account in it, from the copy of the memberships.
   *
   * @type {string}
   * @readonly
   */
  readonly memberId: string;
  // #endregion
}
