/**
 * Class SessionNotFound
 *
 * @description
 * Thrown when no session with an id belongs to the actor (`session.not-found`): a session of
 * another user answers the same as an unknown id.
 */
export class SessionNotFound extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Builds the refusal, without the id.
   *
   * @constructor
   */
  public constructor() {
    super('No session with this id belongs to the actor.');
    this.name = 'SessionNotFound';
  }
  // #endregion
}
