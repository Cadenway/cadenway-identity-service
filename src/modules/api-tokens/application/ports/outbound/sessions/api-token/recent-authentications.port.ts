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
   * request, whether its person proved who they are in the last 10 minutes in a way that counts for
   * the account (a second factor with two-step verification), and whether the account has two-step
   * verification, which gives the methods of a refusal.
   *
   * @param {string} userId - The person, the actor.
   * @param {string} sessionId - The session of the request.
   * @returns {Promise<{ readonly status: 'recent' | 'stale' | 'not-found'; readonly twoStepVerificationEnabled: boolean }>}
   * The status of the session and whether the account has two-step verification.
   */
  check(
    userId: string,
    sessionId: string,
  ): Promise<{
    readonly status: 'recent' | 'stale' | 'not-found';
    readonly twoStepVerificationEnabled: boolean;
  }>;
  // #endregion
}
