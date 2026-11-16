import type { CodeVerificationInput } from '../../../../models/authentication/code-verification-input.model.js';

/**
 * Interface VerifySignUpInput
 *
 * @description
 * The input of `VerifySignUp` (`SignUpVerification` of the contract): the sign-up code, the browser
 * to sign in and, when the client sends it, the password typed in the sign-up form.
 */
export interface VerifySignUpInput extends CodeVerificationInput {
  // #region Properties
  /**
   * Property password
   *
   * @description
   * The password of the sign-up, as the public request carried it, or `undefined` when the client
   * sent none; compared with the hash of the latest sign-up only once the code is right, and never
   * logged.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly password?: string;
  // #endregion
}
