/**
 * Interface CheckSessionAuthenticationOutput
 *
 * @description
 * What a guarded route learns of the session of its request.
 */
export interface CheckSessionAuthenticationOutput {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * `recent` when its person proved who they are in the last 10 minutes, `stale` when the session
   * is open without it (`403 auth.reauthentication-required`), `not-found` when it is not an open
   * session of the person (`404 session.not-found`).
   *
   * @type {'recent' | 'stale' | 'not-found'}
   * @readonly
   */
  readonly status: 'recent' | 'stale' | 'not-found';

  /**
   * Property twoStepVerificationEnabled
   *
   * @description
   * Whether the account has two-step verification, for the methods of a refusal: `[password]`
   * without it, `[authenticator-app]` with it. With it, only a window opened by a second factor is
   * `recent` (P2c-2).
   *
   * @type {boolean}
   * @readonly
   */
  readonly twoStepVerificationEnabled: boolean;
  // #endregion
}
