import { describe, expect, it } from 'vitest';

import { AccountLockedError } from '../../errors/password/account-locked.error.js';
import type { PasswordFailure } from './password-failure.policy.js';
import { PasswordLockout } from './password-lockout.policy.js';

/**
 * Constant NOW
 *
 * @description
 * The instant of the first failure.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-08T13:07:00Z');

/**
 * Function later
 *
 * @description
 * An instant after `NOW`.
 *
 * @param {number} milliseconds - Delay after `NOW`.
 * @returns {Date} The instant.
 */
function later(milliseconds: number): Date {
  return new Date(NOW.getTime() + milliseconds);
}

describe('PasswordLockout', () => {
  it('counts the attempts left down from 4 to 1, then locks for 15 minutes', () => {
    let lockout: PasswordLockout = PasswordLockout.clear();
    const remaining: number[] = [];
    for (let attempt: number = 0; attempt < 4; attempt += 1) {
      const failure: PasswordFailure = lockout.recordFailure(NOW);
      remaining.push(failure.remainingAttempts);
      expect(failure.lockedUntil).toBeNull();
      lockout = failure.lockout;
    }

    const fifth: PasswordFailure = lockout.recordFailure(NOW);

    expect(remaining).toEqual([4, 3, 2, 1]);
    expect(fifth.remainingAttempts).toBe(0);
    expect(fifth.lockedUntil).toEqual(later(15 * 60_000));
  });

  it('shows "3 tentatives restantes" after two failures, as the Main screen does', () => {
    const once: PasswordFailure = PasswordLockout.clear().recordFailure(NOW);

    expect(once.lockout.recordFailure(NOW).remainingAttempts).toBe(3);
  });

  it('refuses every attempt during the lockout, even before the password is checked', () => {
    const locked: PasswordLockout = PasswordLockout.restore({
      failedAttempts: 5,
      lockedUntil: later(15 * 60_000),
    });

    expect(() => {
      locked.assertUnlocked(later(14 * 60_000));
    }).toThrow(AccountLockedError);
    expect(() => locked.recordFailure(later(60_000))).toThrow(AccountLockedError);
  });

  it('clears the lockout started by an attempt counted in advance that had the right password', () => {
    let lockout: PasswordLockout = PasswordLockout.clear();
    for (let attempt: number = 0; attempt < 4; attempt += 1) {
      lockout = lockout.recordFailure(NOW).lockout;
    }
    const fifth: PasswordFailure = lockout.recordFailure(NOW);
    expect(fifth.lockedUntil).not.toBeNull();

    const cleared: PasswordLockout = fifth.lockout.recordSuccess();

    expect(cleared.isClear).toBe(true);
    expect(() => {
      cleared.assertUnlocked(NOW);
    }).not.toThrow();
  });

  it('counts from zero again once the lockout has ended', () => {
    const ended: PasswordLockout = PasswordLockout.restore({
      failedAttempts: 5,
      lockedUntil: later(15 * 60_000),
    });

    expect(() => {
      ended.assertUnlocked(later(15 * 60_000));
    }).not.toThrow();
    expect(ended.recordFailure(later(16 * 60_000)).remainingAttempts).toBe(4);
  });

  it('resets the count after a success', () => {
    const twice: PasswordLockout = PasswordLockout.clear()
      .recordFailure(NOW)
      .lockout.recordFailure(NOW).lockout;

    const cleared: PasswordLockout = twice.recordSuccess();

    expect(cleared.isClear).toBe(true);
    expect(cleared.recordFailure(NOW).remainingAttempts).toBe(4);
  });

  it('refuses a stored count outside 0 to 5', () => {
    expect(() => PasswordLockout.restore({ failedAttempts: 6, lockedUntil: null })).toThrow(
      /0 to 5/u,
    );
    expect(() => PasswordLockout.restore({ failedAttempts: -1, lockedUntil: null })).toThrow(
      /0 to 5/u,
    );
  });

  it('carries the end of the lockout in its error', () => {
    const until: Date = later(15 * 60_000);
    try {
      PasswordLockout.restore({ failedAttempts: 5, lockedUntil: until }).assertUnlocked(NOW);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AccountLockedError);
      expect((error as AccountLockedError).lockedUntil).toEqual(until);
    }
  });
});
