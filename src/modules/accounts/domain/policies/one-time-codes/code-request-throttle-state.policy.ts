/**
 * Interface CodeRequestThrottleState
 *
 * @description
 * The accepted code requests of one address, whether or not an account uses it.
 */
export interface CodeRequestThrottleState {
  // #region Properties
  /**
   * Property lastRequestedAt
   *
   * @description
   * When the last request was accepted, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lastRequestedAt: Date | null;

  /**
   * Property windowStartedAt
   *
   * @description
   * When the current hour of requests started, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly windowStartedAt: Date | null;

  /**
   * Property windowRequests
   *
   * @description
   * Requests accepted since `windowStartedAt`, from 0 to `MAX_REQUESTS_PER_WINDOW`.
   *
   * @type {number}
   * @readonly
   */
  readonly windowRequests: number;
  // #endregion
}
