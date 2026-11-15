import { describe, expect, it } from 'vitest';

import { CodeRequestThrottle } from './code-request-throttle.js';
import type { AcceptedCodeRequest } from './code-request-throttle.js';
import { CodeThrottledError } from './errors.js';

/**
 * Constant FIRST_REQUEST
 *
 * @description
 * When the first request of the address is made.
 *
 * @type {Date}
 */
const FIRST_REQUEST: Date = new Date('2026-11-08T13:07:00Z');

/**
 * Function later
 *
 * @description
 * An instant after `FIRST_REQUEST`.
 *
 * @param {number} milliseconds - Delay after the first request.
 * @returns {Date} The instant.
 */
function later(milliseconds: number): Date {
  return new Date(FIRST_REQUEST.getTime() + milliseconds);
}

/**
 * Function refusalOf
 *
 * @description
 * When a refused request says the next one is accepted.
 *
 * @param {CodeRequestThrottle} throttle - The throttle.
 * @param {Date} now - The instant of the request.
 * @returns {Date} `resendAvailableAt` of the refusal.
 */
function refusalOf(throttle: CodeRequestThrottle, now: Date): Date {
  try {
    throttle.accept(now);
  } catch (error) {
    expect(error).toBeInstanceOf(CodeThrottledError);
    return (error as CodeThrottledError).resendAvailableAt;
  }
  throw new Error('The request was accepted.');
}

describe('CodeRequestThrottle', () => {
  it('accepts the first request of an address, and the next one 30 seconds later', () => {
    const first: AcceptedCodeRequest = CodeRequestThrottle.none().accept(FIRST_REQUEST);

    expect(first.resendAvailableAt).toEqual(new Date('2026-11-08T13:07:30Z'));
    expect(first.throttle.accept(later(30_000)).resendAvailableAt).toEqual(
      new Date('2026-11-08T13:08:00Z'),
    );
  });

  it('refuses a request within 30 seconds, with when the next is accepted', () => {
    const first: AcceptedCodeRequest = CodeRequestThrottle.none().accept(FIRST_REQUEST);

    expect(refusalOf(first.throttle, later(29_999))).toEqual(new Date('2026-11-08T13:07:30Z'));
  });

  it('accepts 5 requests in an hour, then refuses until the hour ends', () => {
    let throttle: CodeRequestThrottle = CodeRequestThrottle.none();
    const availableAt: Date[] = [];
    for (let request: number = 0; request < 5; request += 1) {
      const accepted: AcceptedCodeRequest = throttle.accept(later(request * 60_000));
      availableAt.push(accepted.resendAvailableAt);
      throttle = accepted.throttle;
    }

    expect(availableAt.at(-1)).toEqual(new Date('2026-11-08T14:07:00Z'));
    expect(refusalOf(throttle, later(10 * 60_000))).toEqual(new Date('2026-11-08T14:07:00Z'));
    expect(throttle.accept(later(60 * 60_000)).throttle.snapshot).toEqual({
      lastRequestedAt: later(60 * 60_000),
      windowStartedAt: later(60 * 60_000),
      windowRequests: 1,
    });
  });

  it('refuses a stored count outside 0 to 5', () => {
    expect(() =>
      CodeRequestThrottle.restore({
        lastRequestedAt: FIRST_REQUEST,
        windowStartedAt: FIRST_REQUEST,
        windowRequests: 6,
      }),
    ).toThrow(/0 to 5/u);
  });
});
