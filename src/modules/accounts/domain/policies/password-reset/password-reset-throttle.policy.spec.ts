import { describe, expect, it } from 'vitest';

import { InvalidUserStateError } from '../../errors/accounts/invalid-user-state.error.js';
import { ResetThrottledError } from '../../errors/password-reset/reset-throttled.error.js';
import type { AcceptedPasswordResetRequest } from './accepted-password-reset-request.policy.js';
import { PasswordResetThrottle } from './password-reset-throttle.policy.js';

/**
 * Constant FIRST
 *
 * @description
 * The first request of the specs.
 *
 * @type {Date}
 */
const FIRST: Date = new Date('2026-11-09T13:10:00Z');

/**
 * Function after
 *
 * @description
 * An instant after the first request.
 *
 * @param {number} milliseconds - Delay.
 * @returns {Date} The instant.
 */
function after(milliseconds: number): Date {
  return new Date(FIRST.getTime() + milliseconds);
}

/**
 * Function refusalOf
 *
 * @description
 * The instant a refused request names.
 *
 * @param {() => unknown} request - The request.
 * @returns {Date | null} `resendAvailableAt`, or `null` when accepted.
 */
function refusalOf(request: () => unknown): Date | null {
  try {
    request();
    return null;
  } catch (error) {
    if (error instanceof ResetThrottledError) {
      return error.resendAvailableAt;
    }
    throw error;
  }
}

describe('PasswordResetThrottle', () => {
  it('accepts a first request and offers the next one 45 seconds later', () => {
    const accepted: AcceptedPasswordResetRequest = PasswordResetThrottle.none().accept(FIRST);

    expect(accepted.resendAvailableAt).toEqual(after(45_000));
    expect(accepted.throttle.snapshot).toEqual({
      lastRequestedAt: FIRST,
      windowStartedAt: FIRST,
      windowRequests: 1,
    });
  });

  it('refuses a request less than 45 seconds after the last accepted one', () => {
    const throttle: PasswordResetThrottle = PasswordResetThrottle.none().accept(FIRST).throttle;

    expect(refusalOf(() => throttle.accept(after(44_999)))).toEqual(after(45_000));
    expect(refusalOf(() => throttle.accept(after(45_000)))).toBeNull();
  });

  it('accepts 5 requests in an hour, then refuses until the hour ends', () => {
    let throttle: PasswordResetThrottle = PasswordResetThrottle.none();
    let last: AcceptedPasswordResetRequest | null = null;
    for (let request: number = 0; request < 5; request += 1) {
      last = throttle.accept(after(request * 45_000));
      throttle = last.throttle;
    }

    expect(last?.resendAvailableAt).toEqual(after(60 * 60_000));
    expect(refusalOf(() => throttle.accept(after(10 * 60_000)))).toEqual(after(60 * 60_000));
    expect(throttle.accept(after(60 * 60_000)).throttle.snapshot).toMatchObject({
      windowStartedAt: after(60 * 60_000),
      windowRequests: 1,
    });
  });

  it('refuses a stored count of the hour outside 0 to 5', () => {
    const state: {
      lastRequestedAt: Date | null;
      windowStartedAt: Date | null;
      windowRequests: number;
    } = { lastRequestedAt: FIRST, windowStartedAt: FIRST, windowRequests: 6 };

    expect(() => PasswordResetThrottle.restore(state)).toThrow(InvalidUserStateError);
    expect(() => PasswordResetThrottle.restore({ ...state, windowRequests: -1 })).toThrow(
      InvalidUserStateError,
    );
    expect(PasswordResetThrottle.restore({ ...state, windowRequests: 5 }).snapshot).toEqual({
      ...state,
      windowRequests: 5,
    });
  });
});
