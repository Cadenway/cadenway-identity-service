/**
 * Class ApiTokenNotFound
 *
 * @description
 * Thrown when no token with an id belongs to the actor in the organization of its internal token
 * (`api-token.not-found`): a token of another user or organization answers like an unknown id.
 */
export class ApiTokenNotFound extends Error {
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
    super('No API token with this id belongs to the actor in this organization.');
    this.name = 'ApiTokenNotFound';
  }
  // #endregion
}
