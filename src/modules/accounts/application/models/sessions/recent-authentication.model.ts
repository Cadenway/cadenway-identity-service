/**
 * Interface RecentAuthentication
 *
 * @description
 * The recent authentication a session recorded, and when the guarded routes require it again
 * (`RecentAuthentication` of `openapi/internal/identity-service.yaml`).
 */
export interface RecentAuthentication {
  // #region Properties
  /**
   * Property authenticatedAt
   *
   * @description
   * When the person proved who they are.
   *
   * @type {Date}
   * @readonly
   */
  readonly authenticatedAt: Date;

  /**
   * Property expiresAt
   *
   * @description
   * 10 minutes later.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}
