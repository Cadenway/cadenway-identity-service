/**
 * Interface SessionState
 *
 * @description
 * A stored session. Its token is never part of it: the repository keeps only the SHA-256 hash.
 */
export interface SessionState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id assigned by PostgreSQL.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property userId
   *
   * @description
   * Account the session signs in.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property persistent
   *
   * @description
   * Whether the cookie outlives the browser (`rememberMe`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;

  /**
   * Property lastActiveAt
   *
   * @description
   * Last recorded activity, within `ACTIVITY_RESOLUTION_MS`.
   *
   * @type {Date}
   * @readonly
   */
  readonly lastActiveAt: Date;

  /**
   * Property expiresAt
   *
   * @description
   * When the session ends at the latest, whatever its activity.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property revokedAt
   *
   * @description
   * When the session was revoked, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly revokedAt: Date | null;

  /**
   * Property version
   *
   * @description
   * Version of the session: 1 when opened, 2 once revoked. Activity is not a change of version.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
