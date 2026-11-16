import type { CodeRequestThrottle } from '../../../../../domain/policies/one-time-codes/code-request-throttle.policy.js';
import type { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';

/**
 * Interface CodeRequestRepository
 *
 * @description
 * The throttle of the code requests of each address, bound to the transaction of a unit of work.
 */
export interface CodeRequestRepository {
  // #region Methods
  /**
   * Method lock
   *
   * @description
   * Takes the lock of an address until the end of the transaction, creating its row when needed,
   * and reads its throttle. Two code requests or sign-ups of the same address therefore run one
   * after the other: the throttle, the account and its codes are read and written by one of them at
   * a time.
   *
   * @param {EmailAddress} email - The normalized address.
   * @returns {Promise<CodeRequestThrottle>} The throttle of the address.
   */
  lock(email: EmailAddress): Promise<CodeRequestThrottle>;

  /**
   * Method save
   *
   * @description
   * Writes the throttle after an accepted request, after `lock` in the same transaction.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {CodeRequestThrottle} throttle - The throttle after the request.
   * @returns {Promise<void>} Resolves once written.
   */
  save(email: EmailAddress, throttle: CodeRequestThrottle): Promise<void>;
  // #endregion
}
