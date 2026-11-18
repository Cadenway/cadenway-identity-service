import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/**
 * Interface SignInWithPasswordInput
 *
 * @description
 * A sign-in with a password, as the Main screen sends it (`PasswordSignIn` of the contract).
 */
export interface SignInWithPasswordInput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property password
   *
   * @description
   * The password; never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly password: string;

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

  /**
   * Property trustedDeviceToken
   *
   * @description
   * The value of the cookie `__Host-cw_trusted_device`, when the browser has one: a device the
   * account trusts skips the two-step challenge. A secret, never logged.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly trustedDeviceToken?: string | undefined;
  // #endregion
}
