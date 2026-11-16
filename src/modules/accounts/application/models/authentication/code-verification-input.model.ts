import type { SessionClient } from '../sessions/session-client.model.js';

/**
 * Interface CodeVerificationInput
 *
 * @description
 * A code typed on the Otp screen (`CodeVerification` of the contract), the shape of the inputs of
 * `VerifySignUp` and `SignInWithCode`.
 */
export interface CodeVerificationInput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address the code was sent to, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property code
   *
   * @description
   * The 6 digits; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly code: string;

  /**
   * Property rememberMe
   *
   * @description
   * Whether the session outlives the browser ("Rester connecté pendant 30 jours").
   *
   * @type {boolean}
   * @readonly
   */
  readonly rememberMe: boolean;

  /**
   * Property client
   *
   * @description
   * The browser the session is opened for.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}
