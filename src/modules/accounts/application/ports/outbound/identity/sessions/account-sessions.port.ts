import type { RecentAuthentication } from '../../../../models/sessions/recent-authentication.model.js';
import type { SessionAuthentication } from '../../../../models/sessions/session-authentication.model.js';

/**
 * Interface AccountSessions
 *
 * @description
 * What the security of an account asks of the sessions module, owned by the accounts module. Each
 * call joins the system transaction of the use case, so a change of password, of address or the
 * scheduling of a deletion commits with its effects on the sessions or not at all.
 */
export interface AccountSessions {
  // #region Methods
  /**
   * Method check
   *
   * @description
   * Says whether a session is an open session of the person, and whether its person proved who
   * they are in the last 10 minutes.
   *
   * @param {string} userId - The person, the actor.
   * @param {string} sessionId - The session of the request.
   * @returns {Promise<SessionAuthentication>} `recent`, `stale` or `not-found`.
   */
  check(userId: string, sessionId: string): Promise<SessionAuthentication>;

  /**
   * Method authenticate
   *
   * @description
   * Records that the person of an open session proved who they are now, which opens its 10-minute
   * window of recent authentication.
   *
   * @param {string} userId - The person, the actor.
   * @param {string} sessionId - The session of the request.
   * @param {'password' | 'two-step'} method - How the person proved it (P2c-2).
   * @returns {Promise<RecentAuthentication | null>} The window, or `null` when the session is not
   * an open session of the person.
   */
  authenticate(
    userId: string,
    sessionId: string,
    method: 'password' | 'two-step',
  ): Promise<RecentAuthentication | null>;

  /**
   * Method endRecentAuthentication
   *
   * @description
   * Ends the recent authentication of the open sessions of a person, but one.
   *
   * @param {string} userId - The person.
   * @param {string | null} exceptSessionId - The session that keeps its own, or `null` for none.
   * @param {'every-window' | 'password-windows'} scope - Every window, or only those opened by a
   * password, as turning two-step verification on does (P2c-2).
   * @returns {Promise<void>} Resolves once written.
   */
  endRecentAuthentication(
    userId: string,
    exceptSessionId: string | null,
    scope: 'every-window' | 'password-windows',
  ): Promise<void>;

  /**
   * Method revokeAll
   *
   * @description
   * Revokes the open sessions of a person, but one, each with `session.revoked.v1`.
   *
   * @param {string} userId - The person.
   * @param {string | null} exceptSessionId - The session that stays open, or `null` for none.
   * @returns {Promise<number>} The revoked sessions.
   */
  revokeAll(userId: string, exceptSessionId: string | null): Promise<number>;

  /**
   * Method countOpen
   *
   * @description
   * Counts the open sessions of a person.
   *
   * @param {string} userId - The person.
   * @returns {Promise<number>} The open sessions.
   */
  countOpen(userId: string): Promise<number>;

  /**
   * Method erase
   *
   * @description
   * Deletes every session of a deleted account, with its browser, and its last organization choice.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  erase(userId: string): Promise<void>;
  // #endregion
}
