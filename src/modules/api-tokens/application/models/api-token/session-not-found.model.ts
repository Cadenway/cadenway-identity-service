/**
 * Class SessionNotFound
 *
 * @description
 * The session of the request is not an open session of the actor acting on the organization of the
 * request (`404 session.not-found`, which the gateway answers as `401 auth.session-expired`).
 */
export class SessionNotFound extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the creation.
   *
   * @constructor
   */
  public constructor() {
    super('No open session with this id belongs to the actor.');
    this.name = 'SessionNotFound';
  }
  // #endregion
}
