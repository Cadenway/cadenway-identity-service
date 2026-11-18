import type { Session } from '../../../domain/aggregates/session/session.aggregate.js';

/**
 * Interface SessionRecord
 *
 * @description
 * A stored session with the browser that opened it, as the list of the sessions shows it.
 */
export interface SessionRecord {
  // #region Properties
  /**
   * Property session
   *
   * @description
   * The session.
   *
   * @type {Session}
   * @readonly
   */
  readonly session: Session;

  /**
   * Property ipAddress
   *
   * @description
   * Address of the browser of the sign-in that opened it.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property userAgent
   *
   * @description
   * `User-Agent` of that browser, or `null`; read into a device, never logged.
   *
   * @type {string | null}
   * @readonly
   */
  readonly userAgent: string | null;
  // #endregion
}
