import type { CodeRequestThrottle } from './code-request-throttle.policy.js';

/**
 * Interface AcceptedCodeRequest
 *
 * @description
 * A request the throttle accepted: the state to store and when the next request is accepted.
 */
export interface AcceptedCodeRequest {
  // #region Properties
  /**
   * Property throttle
   *
   * @description
   * The throttle after the request.
   *
   * @type {CodeRequestThrottle}
   * @readonly
   */
  readonly throttle: CodeRequestThrottle;

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
