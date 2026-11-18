import type { PasswordResetThrottle } from '../../../../../domain/policies/password-reset/password-reset-throttle.policy.js';
import type { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';

/**
 * Interface PasswordResetRequestRepository
 *
 * @description
 * The throttle of the password reset requests of each address, account or not.
 */
export interface PasswordResetRequestRepository {
  // #region Methods
  /**
   * Method lock
   *
   * @description
   * Reads the throttle of an address and locks it until the end of the transaction, creating it
   * when the address never asked.
   *
   * @param {EmailAddress} email - The address.
   * @returns {Promise<PasswordResetThrottle>} The throttle.
   */
  lock(email: EmailAddress): Promise<PasswordResetThrottle>;

  /**
   * Method save
   *
   * @description
   * Writes the throttle of an address.
   *
   * @param {EmailAddress} email - The address.
   * @param {PasswordResetThrottle} throttle - The throttle after the request.
   * @returns {Promise<void>} Resolves once written.
   */
  save(email: EmailAddress, throttle: PasswordResetThrottle): Promise<void>;

  /**
   * Method erase
   *
   * @description
   * Removes the throttle of an address, when its account is deleted.
   *
   * @param {EmailAddress} email - The address.
   * @returns {Promise<void>} Resolves once removed.
   */
  erase(email: EmailAddress): Promise<void>;
  // #endregion
}
