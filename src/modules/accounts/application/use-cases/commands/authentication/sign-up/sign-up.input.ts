/**
 * Interface SignUpInput
 *
 * @description
 * A sign-up as the Inscription screen sends it (`SignUpRequest` of the contract).
 */
export interface SignUpInput {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Full name as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Address to sign up, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property password
   *
   * @description
   * The new password; never logged, hashed before anything is stored.
   *
   * @type {string}
   * @readonly
   */
  readonly password: string;

  /**
   * Property acceptTerms
   *
   * @description
   * Whether the person accepts the terms of use and the privacy policy.
   *
   * @type {boolean}
   * @readonly
   */
  readonly acceptTerms: boolean;
  // #endregion
}
