/**
 * Class ReauthenticationRequired
 *
 * @description
 * The session of the request has no recent authentication that counts for its account, or the
 * request names none (`403 auth.reauthentication-required` of `POST /internal/v1/api-tokens`,
 * decision 4 of P2c): nothing is created. The methods of the refusal follow the two-step
 * verification of the account (P2c-2).
 */
export class ReauthenticationRequired extends Error {
  // #region Properties
  /**
   * Property twoStepVerificationEnabled
   *
   * @description
   * Whether the account has two-step verification: `[authenticator-app]` then, `[password]`
   * otherwise.
   *
   * @type {boolean}
   * @readonly
   */
  public readonly twoStepVerificationEnabled: boolean;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the creation.
   *
   * @param {boolean} twoStepVerificationEnabled - Whether the account has two-step verification.
   * @constructor
   */
  public constructor(twoStepVerificationEnabled: boolean = false) {
    super('The session has no authentication in the last 10 minutes.');
    this.name = 'ReauthenticationRequired';
    this.twoStepVerificationEnabled = twoStepVerificationEnabled;
  }
  // #endregion
}
