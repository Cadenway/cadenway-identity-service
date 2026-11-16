import type { PasswordLockout } from '../../../../../domain/policies/password/password-lockout.policy.js';
import type { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';

/**
 * Interface SignInAttemptRepository
 *
 * @description
 * The password lockout of each address, bound to the transaction of a unit of work.
 */
export interface SignInAttemptRepository {
  // #region Methods
  /**
   * Method lock
   *
   * @description
   * Takes the lock of an address until the end of the transaction and reads its lockout, so two
   * password sign-ins of one address are counted one after the other.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<PasswordLockout>} The lockout, clear when nothing is counted.
   */
  lock(email: EmailAddress): Promise<PasswordLockout>;

  /**
   * Method save
   *
   * @description
   * Writes the lockout of an address after `lock`. The row is kept when clear, so a sign-in waiting
   * on its lock always finds it.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {PasswordLockout} lockout - The lockout to store.
   * @returns {Promise<void>} Resolves once written.
   */
  save(email: EmailAddress, lockout: PasswordLockout): Promise<void>;
  // #endregion
}
