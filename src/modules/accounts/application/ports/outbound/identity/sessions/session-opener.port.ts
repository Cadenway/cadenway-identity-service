import type { OpenedSession } from '../../../../models/sessions/opened-session.model.js';
import type { SessionRequest } from '../../../../models/sessions/session-request.model.js';

/**
 * Interface SessionOpener
 *
 * @description
 * Opens a session through the sessions module, which owns them. Called inside the unit of work of
 * a sign-in: the session commits, or rolls back, with the verification that opened it.
 */
export interface SessionOpener {
  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens a session for an account.
   *
   * @param {SessionRequest} request - The account, the persistence and the browser.
   * @returns {Promise<OpenedSession>} The session and its token.
   */
  open(request: SessionRequest): Promise<OpenedSession>;
  // #endregion
}
