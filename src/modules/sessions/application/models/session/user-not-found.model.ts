/**
 * Class UserNotFound
 *
 * @description
 * The account of the path is not the actor (`404 user.not-found` of
 * `GET /internal/v1/users/{userId}/sessions`): a person lists only their own sessions.
 */
export class UserNotFound extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the account of another person.
   *
   * @constructor
   */
  public constructor() {
    super('No account with this id is readable by the actor.');
    this.name = 'UserNotFound';
  }
  // #endregion
}
