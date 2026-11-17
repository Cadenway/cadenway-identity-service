/**
 * Class ReauthenticationRequired
 *
 * @description
 * The session of the request has no recent authentication, or the request names none
 * (`403 auth.reauthentication-required` of `POST /internal/v1/api-tokens`, decision 4 of P2c):
 * nothing is created.
 */
export class ReauthenticationRequired extends Error {
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
    super('The session has no authentication in the last 10 minutes.');
    this.name = 'ReauthenticationRequired';
  }
  // #endregion
}
