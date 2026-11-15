import { CodeThrottledError, InvalidUserStateError } from './errors.js';

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

/**
 * Class CodeRequestThrottle
 *
 * @description
 * How often a code may be asked for one address, whatever the purpose. Sources:
 *
 * - `openapi/internal/identity-service.yaml`: "at most one request every 30 seconds per address,
 *   account or not"; a repeated sign-up "follows the 30-second throttle of the codes"; and the
 *   "Renvoyer le code (30 s)" of the Otp screen of the mockup;
 * - decision of this service (security review of the walking skeleton): at most 5 accepted requests
 *   per address in an hour. Each code takes 5 wrong attempts, so without a cap two codes a minute
 *   would allow about 14 400 guesses a day at a 6-digit code; with it, 25 an hour. The cap answers
 *   the same `auth.code-throttled`, with the end of the hour as `resendAvailableAt`.
 *
 * The throttle counts requests, not codes: a request for an address without an account counts too,
 * so the answer never tells whether an account exists.
 */
export class CodeRequestThrottle {
  // #region Properties
  /**
   * Property INTERVAL_MS
   *
   * @description
   * Time between two accepted requests of an address, in milliseconds.
   *
   * @type {number}
   * @readonly
   */
  public static readonly INTERVAL_MS: number = 30_000;

  /**
   * Property WINDOW_MS
   *
   * @description
   * Length of the window of the cap, in milliseconds.
   *
   * @type {number}
   * @readonly
   */
  public static readonly WINDOW_MS: number = 60 * 60_000;

  /**
   * Property MAX_REQUESTS_PER_WINDOW
   *
   * @description
   * Requests of an address accepted in one window.
   *
   * @type {number}
   * @readonly
   */
  public static readonly MAX_REQUESTS_PER_WINDOW: number = 5;

  /**
   * Property state
   *
   * @description
   * The state of the throttle; a request returns a new `CodeRequestThrottle`.
   *
   * @type {CodeRequestThrottleState}
   * @readonly
   */
  private readonly state: CodeRequestThrottleState;

  /**
   * Property snapshot
   *
   * @description
   * The state to store.
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
   * Keeps a state checked by `restore`.
   *
   * @param {CodeRequestThrottleState} state - The checked state.
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
   * The throttle of an address that never asked for a code.
   *
   * @returns {CodeRequestThrottle} An empty throttle.
   */
  public static none(): CodeRequestThrottle {
    return new CodeRequestThrottle({
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
   * @returns {CodeRequestThrottle} The throttle.
   * @throws {InvalidUserStateError} When the count is outside 0 to 5.
   */
  public static restore(state: CodeRequestThrottleState): CodeRequestThrottle {
    if (
      !Number.isInteger(state.windowRequests) ||
      state.windowRequests < 0 ||
      state.windowRequests > CodeRequestThrottle.MAX_REQUESTS_PER_WINDOW
    ) {
      throw new InvalidUserStateError('the code requests of an hour count from 0 to 5');
    }
    return new CodeRequestThrottle(state);
  }

  /**
   * Method accept
   *
   * @description
   * Accepts a request at `now`, or refuses it within 30 seconds of the last one, or once 5 were
   * accepted in the current hour.
   *
   * @param {Date} now - The instant of the request.
   * @returns {AcceptedCodeRequest} The throttle to store and when the next request is accepted.
   * @throws {CodeThrottledError} When the request is refused, with when the next is accepted.
   */
  public accept(now: Date): AcceptedCodeRequest {
    const instant: number = now.getTime();
    const windowStart: number | null = this.state.windowStartedAt?.getTime() ?? null;
    const windowOpen: boolean =
      windowStart !== null && instant < windowStart + CodeRequestThrottle.WINDOW_MS;
    if (
      windowOpen &&
      windowStart !== null &&
      this.state.windowRequests >= CodeRequestThrottle.MAX_REQUESTS_PER_WINDOW
    ) {
      throw new CodeThrottledError(new Date(windowStart + CodeRequestThrottle.WINDOW_MS));
    }
    const last: number | null = this.state.lastRequestedAt?.getTime() ?? null;
    if (last !== null && instant < last + CodeRequestThrottle.INTERVAL_MS) {
      throw new CodeThrottledError(new Date(last + CodeRequestThrottle.INTERVAL_MS));
    }
    const throttle: CodeRequestThrottle = new CodeRequestThrottle(
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
   * When the next request is accepted: 30 seconds after the last one, or the end of the hour once
   * its cap is reached.
   *
   * @returns {Date} The first instant the next request is accepted.
   */
  private nextAvailableAt(): Date {
    const afterInterval: number =
      (this.state.lastRequestedAt?.getTime() ?? 0) + CodeRequestThrottle.INTERVAL_MS;
    const windowStart: number | null = this.state.windowStartedAt?.getTime() ?? null;
    if (
      windowStart !== null &&
      this.state.windowRequests >= CodeRequestThrottle.MAX_REQUESTS_PER_WINDOW
    ) {
      return new Date(Math.max(afterInterval, windowStart + CodeRequestThrottle.WINDOW_MS));
    }
    return new Date(afterInterval);
  }
  // #endregion
}
