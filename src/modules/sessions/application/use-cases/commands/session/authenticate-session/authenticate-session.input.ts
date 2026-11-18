/**
 * Interface AuthenticateSessionInput
 *
 * @description
 * The session whose person has just proved who they are.
 */
export interface AuthenticateSessionInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * The person, the actor.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property method
   *
   * @description
   * How the person proved it: `password` (a confirmed or a current password), `two-step` (a code of
   * the authenticator app, the code that confirms it).
   *
   * @type {'password' | 'two-step'}
   * @readonly
   */
  readonly method: 'password' | 'two-step';
  // #endregion
}
