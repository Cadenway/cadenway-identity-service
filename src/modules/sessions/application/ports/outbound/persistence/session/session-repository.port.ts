import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type { SessionStart } from '../../../../../domain/value-objects/session/session-start.value-object.js';
import type { SessionOrigin } from '../../../../models/session/session-origin.model.js';
import type { SessionPosition } from '../../../../models/session/session-position.model.js';
import type { SessionRecord } from '../../../../models/session/session-record.model.js';

/**
 * Interface SessionRepository
 *
 * @description
 * The sessions, bound to the transaction of a unit of work. A session belongs to its account, not
 * to its current organization: every read names it by its id or by the hash of its token.
 */
export interface SessionRepository {
  // #region Methods
  /**
   * Method insert
   *
   * @description
   * Stores a new session; PostgreSQL assigns its id.
   *
   * @param {SessionStart} start - The session to store.
   * @param {SessionOrigin} origin - Its token hash and its browser.
   * @returns {Promise<Session>} The stored session, with its id.
   */
  insert(start: SessionStart, origin: SessionOrigin): Promise<Session>;

  /**
   * Method findByTokenHash
   *
   * @description
   * Loads the session of a token hash, without a lock.
   *
   * @param {string} tokenHash - SHA-256 of the presented token.
   * @returns {Promise<Session | null>} The session, or `null` for an unknown token.
   */
  findByTokenHash(tokenHash: string): Promise<Session | null>;

  /**
   * Method findForUpdate
   *
   * @description
   * Loads a session by its id and locks it until the end of the transaction.
   *
   * @param {string} id - Id of the session.
   * @returns {Promise<Session | null>} The session, or `null` for an unknown id.
   */
  findForUpdate(id: string): Promise<Session | null>;

  /**
   * Method recordActivity
   *
   * @description
   * Writes the last activity of a session, never moving it back.
   *
   * @param {Session} session - The session after the activity.
   * @returns {Promise<void>} Resolves once written.
   */
  recordActivity(session: Session): Promise<void>;

  /**
   * Method chooseOrganization
   *
   * @description
   * Writes the current organization, its membership and the version of a session locked by
   * `findForUpdate`.
   *
   * @param {Session} session - The session after the choice.
   * @returns {Promise<void>} Resolves once written.
   */
  chooseOrganization(session: Session): Promise<void>;

  /**
   * Method revoke
   *
   * @description
   * Writes the revocation of a session, locked by `findForUpdate`.
   *
   * @param {Session} session - The revoked session.
   * @returns {Promise<void>} Resolves once written.
   */
  revoke(session: Session): Promise<void>;

  /**
   * Method findById
   *
   * @description
   * Reads a session by its id, without a lock.
   *
   * @param {string} id - Id of the session.
   * @returns {Promise<Session | null>} The session, or `null`.
   */
  findById(id: string): Promise<Session | null>;

  /**
   * Method lockOpenOfUser
   *
   * @description
   * Reads and locks the sessions of an account that are open at an instant: neither revoked,
   * expired nor idle for 12 hours, in the order of their ids.
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @returns {Promise<Session[]>} The open sessions.
   */
  lockOpenOfUser(userId: string, now: Date): Promise<Session[]>;

  /**
   * Method countOpen
   *
   * @description
   * Counts the sessions of an account that are open at an instant.
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @returns {Promise<number>} The open sessions.
   */
  countOpen(userId: string, now: Date): Promise<number>;

  /**
   * Method listOpen
   *
   * @description
   * Reads one page of the sessions of an account open at an instant, the most recent sign-in
   * first, then by id, after a position.
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @param {SessionPosition | null} after - The end of the previous page, or `null`.
   * @param {number} count - Sessions to read at most.
   * @returns {Promise<SessionRecord[]>} The sessions with their browser.
   */
  listOpen(
    userId: string,
    now: Date,
    after: SessionPosition | null,
    count: number,
  ): Promise<SessionRecord[]>;

  /**
   * Method findUserAgentsSince
   *
   * @description
   * Reads the distinct `User-Agent` of the sessions of an account active since an instant, whatever
   * their state now, the one used last first.
   *
   * @param {string} userId - The account.
   * @param {Date} since - The instant.
   * @param {number} limit - Headers to read at most.
   * @returns {Promise<(string | null)[]>} The headers, `null` for a browser that sent none.
   */
  findUserAgentsSince(userId: string, since: Date, limit: number): Promise<(string | null)[]>;

  /**
   * Method saveAuthentication
   *
   * @description
   * Writes the recent authentication of a session, or its end.
   *
   * @param {Session} session - The session after the change.
   * @returns {Promise<void>} Resolves once written.
   */
  saveAuthentication(session: Session): Promise<void>;

  /**
   * Method eraseOfUser
   *
   * @description
   * Deletes every session of a deleted account, open or not, with its browser.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  eraseOfUser(userId: string): Promise<void>;
  // #endregion
}
