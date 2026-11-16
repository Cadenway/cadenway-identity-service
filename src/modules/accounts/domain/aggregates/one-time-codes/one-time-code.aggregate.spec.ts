import { describe, expect, it } from 'vitest';

import type { OneTimeCodeCheck } from './one-time-code-check.aggregate.js';
import type { OneTimeCodeState } from './one-time-code-state.aggregate.js';
import { OneTimeCode } from './one-time-code.aggregate.js';

/**
 * Constant ISSUED_AT
 *
 * @description
 * When the code of the specs was issued.
 *
 * @type {Date}
 */
const ISSUED_AT: Date = new Date('2026-11-08T13:07:00Z');

/**
 * Function storedCode
 *
 * @description
 * A stored code of Camille Martin, issued at `ISSUED_AT`.
 *
 * @param {Partial<OneTimeCodeState>} changes - Members that differ.
 * @returns {OneTimeCode} The code.
 */
function storedCode(changes: Partial<OneTimeCodeState> = {}): OneTimeCode {
  return OneTimeCode.restore({
    id: '019a6b10-0000-7000-8000-000000000001',
    userId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
    purpose: 'email-verification',
    codeHash: 'hash-of-482913',
    expiresAt: OneTimeCode.expiryFor('email-verification', ISSUED_AT),
    failedAttempts: 0,
    consumedAt: null,
    replacedAt: null,
    ...changes,
  });
}

/**
 * Function minutesLater
 *
 * @description
 * An instant after `ISSUED_AT`.
 *
 * @param {number} minutes - Delay, in minutes.
 * @returns {Date} The instant.
 */
function minutesLater(minutes: number): Date {
  return new Date(ISSUED_AT.getTime() + minutes * 60_000);
}

describe('OneTimeCode', () => {
  it('expires 10 minutes after it is issued for a sign-up or a sign-in, 15 for an email change', () => {
    expect(OneTimeCode.issue('user', 'email-verification', 'hash', ISSUED_AT).expiresAt).toEqual(
      minutesLater(10),
    );
    expect(OneTimeCode.issue('user', 'sign-in', 'hash', ISSUED_AT).expiresAt).toEqual(
      minutesLater(10),
    );
    expect(OneTimeCode.issue('user', 'email-change', 'hash', ISSUED_AT).expiresAt).toEqual(
      minutesLater(15),
    );
  });

  it('accepts the right code before its expiry, and consumes it', () => {
    const check: OneTimeCodeCheck = storedCode().check('hash-of-482913', minutesLater(9));

    expect(check.outcome).toBe('accepted');
    if (check.outcome === 'accepted') {
      expect(check.code.snapshot.consumedAt).toEqual(minutesLater(9));
      expect(check.code.worksAt(minutesLater(9))).toBe(false);
    }
  });

  it('refuses the right code once expired', () => {
    expect(storedCode().check('hash-of-482913', minutesLater(10)).outcome).toBe('expired');
  });

  it('refuses a code already used or replaced', () => {
    expect(storedCode({ consumedAt: ISSUED_AT }).check('hash-of-482913', ISSUED_AT).outcome).toBe(
      'expired',
    );
    expect(storedCode({ replacedAt: ISSUED_AT }).check('hash-of-482913', ISSUED_AT).outcome).toBe(
      'expired',
    );
  });

  it('counts a wrong code, and stops working after the fifth', () => {
    let code: OneTimeCode = storedCode();
    for (let attempt: number = 1; attempt <= 5; attempt += 1) {
      const check: OneTimeCodeCheck = code.check('hash-of-000000', minutesLater(1));
      expect(check.outcome).toBe('refused');
      if (check.outcome !== 'refused') {
        return;
      }
      expect(check.code.snapshot.failedAttempts).toBe(attempt);
      code = check.code;
    }

    expect(code.check('hash-of-482913', minutesLater(1)).outcome).toBe('expired');
  });

  it('refuses a candidate of another length without comparing it', () => {
    expect(storedCode().check('hash', minutesLater(1)).outcome).toBe('refused');
  });

  it('refuses a stored attempt count outside 0 to 5', () => {
    expect(() => storedCode({ failedAttempts: 6 })).toThrow(/0 to 5/u);
  });
});
