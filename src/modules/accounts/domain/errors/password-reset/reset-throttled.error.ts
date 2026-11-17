import { DomainError } from '../accounts/domain.error.js';

/**
 * Class ResetThrottledError
 *
 * @description
 * A password reset request of an address made too soon after the previous one, or past the hourly
 * cap (`429 auth.reset-throttled` of `POST /v1/auth/password-reset`).
 */
export class ResetThrottledError extends DomainError {
  // #region Properties
  /**
   * Property resendAvailableAt
   *
   * @description
   * When the next request of the address is accepted.
   *
   * @type {Date}
   * @readonly
   */
  public readonly resendAvailableAt: Date;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Refuses the request until `resendAvailableAt`.
   *
   * @param {Date} resendAvailableAt - When the next request is accepted.
   * @constructor
   */
  public constructor(resendAvailableAt: Date) {
    super('The password reset requests of this address are throttled.');
    this.resendAvailableAt = resendAvailableAt;
  }
  // #endregion
}
