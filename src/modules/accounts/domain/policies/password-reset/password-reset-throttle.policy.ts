import { InvalidUserStateError } from '../../errors/accounts/invalid-user-state.error.js';
import { ResetThrottledError } from '../../errors/password-reset/reset-throttled.error.js';
import type { CodeRequestThrottleState } from '../one-time-codes/code-request-throttle-state.policy.js';
import type { AcceptedPasswordResetRequest } from './accepted-password-reset-request.policy.js';

/**
 * Class PasswordResetThrottle
 *
 * @description
 * The throttle of the password reset requests of one address, whether or not an account uses it,
 * apart from the code requests (`ResetThrottled` of `openapi/internal/identity-service.yaml`,
 * decision 2 of P2c, "Renvoyer l'e-mail dans 0:45" of the mockup):
 *
 * - a request is refused less than 45 seconds after the last accepted one;
 * - at most 5 are accepted in an hour, which starts with the first request accepted after the
 *   previous hour ended;
 * - `resendAvailableAt` is 45 seconds after the last accepted request, or the end of the hour once
 *   5 were accepted in it.
 *
 * Its state has the shape of the code request throttle, kept in a table of its own.
 */
export class PasswordResetThrottle {
  // #region Properties
  /**
   * Property INTERVAL_MS
   *
   * @description
   * Shortest delay between two accepted requests: 45 seconds.
   *
   * @type {number}
   * @readonly
   */
  public static readonly INTERVAL_MS: number = 45_000;

  /**
   * Property WINDOW_MS
   *
   * @description
   * Length of the hour the requests are counted in.
   *
   * @type {number}
   * @readonly
   */
  public static readonly WINDOW_MS: number = 60 * 60_000;

  /**
   * Property MAX_REQUESTS_PER_WINDOW
   *
   * @description
   * Requests accepted in an hour at most.
   *
   * @type {number}
   * @readonly
   */
  public static readonly MAX_REQUESTS_PER_WINDOW: number = 5;

  /**
   * Property state
   *
   * @description
   * The accepted requests of the address.
   *
   * @type {CodeRequestThrottleState}
   * @readonly
   */
  private readonly state: CodeRequestThrottleState;

  /**
   * Property snapshot
   *
   * @description
   * The state, for the repository.
   *
   * @type {CodeRequestThrottleState}
   * @readonly
   */
  public get snapshot(): CodeRequestThrottleState {
    return this.state;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps a checked state.
   *
   * @param {CodeRequestThrottleState} state - The state.
   * @constructor
   */
  private constructor(state: CodeRequestThrottleState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method none
   *
   * @description
   * The throttle of an address that never asked for a link.
   *
   * @returns {PasswordResetThrottle} An empty throttle.
   */
  public static none(): PasswordResetThrottle {
    return new PasswordResetThrottle({
      lastRequestedAt: null,
      windowStartedAt: null,
      windowRequests: 0,
    });
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored throttle.
   *
   * @param {CodeRequestThrottleState} state - The stored state.
   * @returns {PasswordResetThrottle} The throttle.
   * @throws {InvalidUserStateError} When the count of the hour is outside 0 to 5.
   */
  public static restore(state: CodeRequestThrottleState): PasswordResetThrottle {
    if (
      !Number.isInteger(state.windowRequests) ||
      state.windowRequests < 0 ||
      state.windowRequests > PasswordResetThrottle.MAX_REQUESTS_PER_WINDOW
    ) {
      throw new InvalidUserStateError('the password reset requests of an hour count from 0 to 5');
    }
    return new PasswordResetThrottle(state);
  }

  /**
   * Method accept
   *
   * @description
   * Accepts a request at an instant, or refuses it.
   *
   * @param {Date} now - When the request arrives.
   * @returns {AcceptedPasswordResetRequest} The throttle after the request and when the next one is
   * accepted.
   * @throws {ResetThrottledError} When the request comes too soon or past the hourly cap.
   */
  public accept(now: Date): AcceptedPasswordResetRequest {
    const instant: number = now.getTime();
    const windowStart: number | null = this.state.windowStartedAt?.getTime() ?? null;
    const windowOpen: boolean =
      windowStart !== null && instant < windowStart + PasswordResetThrottle.WINDOW_MS;
    if (
      windowOpen &&
      windowStart !== null &&
      this.state.windowRequests >= PasswordResetThrottle.MAX_REQUESTS_PER_WINDOW
    ) {
      throw new ResetThrottledError(new Date(windowStart + PasswordResetThrottle.WINDOW_MS));
    }
    const last: number | null = this.state.lastRequestedAt?.getTime() ?? null;
    if (last !== null && instant < last + PasswordResetThrottle.INTERVAL_MS) {
      throw new ResetThrottledError(new Date(last + PasswordResetThrottle.INTERVAL_MS));
    }
    const throttle: PasswordResetThrottle = new PasswordResetThrottle(
      windowOpen
        ? {
            lastRequestedAt: now,
            windowStartedAt: this.state.windowStartedAt,
            windowRequests: this.state.windowRequests + 1,
          }
        : { lastRequestedAt: now, windowStartedAt: now, windowRequests: 1 },
    );
    return { throttle, resendAvailableAt: throttle.nextAvailableAt() };
  }

  /**
   * Method nextAvailableAt
   *
   * @description
   * When the next request is accepted after the last accepted one.
   *
   * @returns {Date} 45 seconds after it, or the end of the hour once its cap is reached.
   */
  private nextAvailableAt(): Date {
    const afterInterval: number =
      (this.state.lastRequestedAt?.getTime() ?? 0) + PasswordResetThrottle.INTERVAL_MS;
    const windowStart: number | null = this.state.windowStartedAt?.getTime() ?? null;
    if (
      windowStart !== null &&
      this.state.windowRequests >= PasswordResetThrottle.MAX_REQUESTS_PER_WINDOW
    ) {
      return new Date(Math.max(afterInterval, windowStart + PasswordResetThrottle.WINDOW_MS));
    }
    return new Date(afterInterval);
  }
  // #endregion
}
