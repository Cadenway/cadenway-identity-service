import type { PasswordResetThrottle } from './password-reset-throttle.policy.js';

/**
 * Interface AcceptedPasswordResetRequest
 *
 * @description
 * A password reset request the throttle accepted: the state to store and when the next request is
 * accepted.
 */
export interface AcceptedPasswordResetRequest {
  // #region Properties
  /**
   * Property throttle
   *
   * @description
   * The throttle after the request.
   *
   * @type {PasswordResetThrottle}
   * @readonly
   */
  readonly throttle: PasswordResetThrottle;

  /**
   * Property resendAvailableAt
   *
   * @description
   * When the next request of the address is accepted.
   *
   * @type {Date}
   * @readonly
   */
  readonly resendAvailableAt: Date;
  // #endregion
}
