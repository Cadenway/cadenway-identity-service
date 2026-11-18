/**
 * Interface RecentAuthentications
 *
 * @description
 * The recent authentication of the session of a request, owned by the api-tokens module and bound
 * to the sessions module. The check joins the tenant transaction of the creation of a token.
 */
export interface RecentAuthentications {
  // #region Methods
  /**
   * Method check
   *
   * @description
   * Says whether a session is an open session of the person acting on the organization of the
   * request, and whether its person proved who they are in the last 10 minutes.
   *
   * @param {string} userId - The person, the actor.
   * @param {string} sessionId - The session of the request.
   * @returns {Promise<'recent' | 'stale' | 'not-found'>} The status of the session.
   */
  check(userId: string, sessionId: string): Promise<'recent' | 'stale' | 'not-found'>;
  // #endregion
}
