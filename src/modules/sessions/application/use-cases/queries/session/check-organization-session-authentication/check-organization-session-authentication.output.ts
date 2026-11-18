/**
 * Interface CheckOrganizationSessionAuthenticationOutput
 *
 * @description
 * What the creation of a personal API token learns of the session of its request.
 */
export interface CheckOrganizationSessionAuthenticationOutput {
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
  // #endregion
}
