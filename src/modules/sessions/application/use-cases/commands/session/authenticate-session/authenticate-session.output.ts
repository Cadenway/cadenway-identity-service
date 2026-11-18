/**
 * Interface AuthenticateSessionOutput
 *
 * @description
 * The recent authentication a session recorded (`RecentAuthentication` of
 * `openapi/internal/identity-service.yaml`).
 */
export interface AuthenticateSessionOutput {
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
   * 10 minutes later, when the guarded routes require it again.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;
  // #endregion
}
