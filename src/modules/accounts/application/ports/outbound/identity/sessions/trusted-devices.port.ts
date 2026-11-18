import type { TrustedDeviceGrant } from '../../../../models/sessions/trusted-device-grant.model.js';

/**
 * Interface TrustedDevices
 *
 * @description
 * The trusted devices of the accounts, which the sessions module owns. Each call joins the system
 * transaction of its caller.
 */
export interface TrustedDevices {
  // #region Methods
  /**
   * Method trust
   *
   * @description
   * Makes the browser of a challenge answer a trusted device of the account for 30 days.
   *
   * @param {string} userId - The account.
   * @returns {Promise<TrustedDeviceGrant>} The device token, returned once, and its expiry.
   */
  trust(userId: string): Promise<TrustedDeviceGrant>;

  /**
   * Method isTrusted
   *
   * @description
   * Whether a device cookie names a device the account trusts.
   *
   * @param {string} userId - The account.
   * @param {string} token - The cookie value.
   * @returns {Promise<boolean>} `true` for a trusted device of the account.
   */
  isTrusted(userId: string, token: string): Promise<boolean>;

  /**
   * Method forget
   *
   * @description
   * Forgets every trusted device of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once forgotten.
   */
  forget(userId: string): Promise<void>;
  // #endregion
}
