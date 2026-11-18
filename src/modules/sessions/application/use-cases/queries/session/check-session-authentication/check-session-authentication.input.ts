/**
 * Interface CheckSessionAuthenticationInput
 *
 * @description
 * The session of a request of a person whose recent authentication a guarded route checks.
 */
export interface CheckSessionAuthenticationInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The person, the actor of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the request, as the introspection returned it.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}
