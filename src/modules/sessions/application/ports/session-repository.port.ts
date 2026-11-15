import type { Session, SessionStart } from '../../domain/session.js';
import type { DeviceDescription } from './device-reader.port.js';

/**
 * Interface SessionOrigin
 *
 * @description
 * Where a session was opened: stored with it to show its device and place later, never logged with
 * its token.
 */
export interface SessionOrigin {
  // #region Properties
  /**
   * Property tokenHash
   *
   * @description
   * SHA-256 of the token.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;

  /**
   * Property ipAddress
   *
   * @description
   * Address of the browser, as the gateway saw it.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property userAgent
   *
   * @description
   * `User-Agent` of the browser, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly userAgent: string | null;

  /**
   * Property device
   *
   * @description
   * What the `User-Agent` tells about the device.
   *
   * @type {DeviceDescription}
   * @readonly
   */
  readonly device: DeviceDescription;
  // #endregion
}

/**
 * Interface SessionRepository
 *
 * @description
 * The sessions, bound to the transaction of a unit of work. A session belongs to no organization:
 * every read names it by its id or by the hash of its token.
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
   * Method revoke
   *
   * @description
   * Writes the revocation of a session, locked by `findForUpdate`.
   *
   * @param {Session} session - The revoked session.
   * @returns {Promise<void>} Resolves once written.
   */
  revoke(session: Session): Promise<void>;
  // #endregion
}
