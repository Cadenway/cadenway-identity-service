import { describe, expect, it } from 'vitest';

import { InvalidTwoStepStateError } from '../../errors/two-step/invalid-two-step-state.error.js';
import { TwoStepLockedError } from '../../errors/two-step/two-step-locked.error.js';
import type { TwoStepFailure } from './two-step-failure.aggregate.js';
import { TwoStepVerification } from './two-step-verification.aggregate.js';

/**
 * Constant ENABLED_AT
 *
 * @description
 * When Camille Martin turned two-step verification on ("Configurée le 3 mars 2026").
 *
 * @type {Date}
 */
const ENABLED_AT: Date = new Date('2026-03-03T10:15:00Z');

/**
 * Constant NOW
 *
 * @description
 * The instant of the answers.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-09T07:42:00Z');

/**
 * Function enabled
 *
 * @description
 * The two-step verification of Camille Martin, its app confirmed at the time step 100.
 *
 * @returns {TwoStepVerification} The verification.
 */
function enabled(): TwoStepVerification {
  return TwoStepVerification.enable(
    '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
    'k1.nonce.ciphertext.tag',
    100,
    'handle-of-camille',
    ENABLED_AT,
  );
}

/**
 * Function wrongTimes
 *
 * @description
 * The verification after wrong answers in a row at the same instant.
 *
 * @param {TwoStepVerification} verification - The verification.
 * @param {number} count - How many.
 * @param {Date} at - When.
 * @returns {TwoStepFailure} The last failure.
 */
function wrongTimes(verification: TwoStepVerification, count: number, at: Date): TwoStepFailure {
  let failure: TwoStepFailure = verification.recordWrongAnswer(at);
  for (let answer: number = 1; answer < count; answer += 1) {
    failure = failure.verification.recordWrongAnswer(at);
  }
  return failure;
}

describe('TwoStepVerification', () => {
  it('turns on with the accepted step, the backup codes and no wrong answer', () => {
    expect(enabled().snapshot).toMatchObject({
      authenticatorConfiguredAt: ENABLED_AT,
      lastAcceptedTimeStep: 100,
      failedAnswers: 0,
      lockedUntil: null,
      backupCodesGeneratedAt: ENABLED_AT,
      enabledAt: ENABLED_AT,
    });
  });

  it('counts down 4 wrong answers, then locks for 15 minutes at the fifth', () => {
    expect(wrongTimes(enabled(), 1, NOW)).toMatchObject({
      remainingAttempts: 4,
      lockedUntil: null,
    });
    expect(wrongTimes(enabled(), 4, NOW)).toMatchObject({
      remainingAttempts: 1,
      lockedUntil: null,
    });

    const fifth: TwoStepFailure = wrongTimes(enabled(), 5, NOW);

    expect(fifth).toMatchObject({
      remainingAttempts: 0,
      lockedUntil: new Date('2026-11-09T07:57:00Z'),
    });
    expect(fifth.verification.lockedUntilAt(NOW)).toEqual(new Date('2026-11-09T07:57:00Z'));
  });

  it('refuses every answer during the lockout, and counts again from zero after it', () => {
    const locked: TwoStepVerification = wrongTimes(enabled(), 5, NOW).verification;

    expect(() => locked.recordWrongAnswer(new Date('2026-11-09T07:56:59Z'))).toThrow(
      TwoStepLockedError,
    );
    expect(locked.lockedUntilAt(new Date('2026-11-09T07:57:00Z'))).toBeNull();
    expect(locked.recordWrongAnswer(new Date('2026-11-09T07:57:00Z'))).toMatchObject({
      remainingAttempts: 4,
      lockedUntil: null,
    });
  });

  it('ends the count of wrong answers with a right one', () => {
    const answered: TwoStepVerification = wrongTimes(
      enabled(),
      3,
      NOW,
    ).verification.recordRightAnswer(101);

    expect(answered.snapshot).toMatchObject({ failedAnswers: 0, lastAcceptedTimeStep: 101 });
    expect(answered.recordWrongAnswer(NOW).remainingAttempts).toBe(4);
  });

  it('accepts a code of the app once: a step at or before the last one is refused', () => {
    expect(() => enabled().recordRightAnswer(100)).toThrow(InvalidTwoStepStateError);
    expect(() => enabled().recordRightAnswer(99)).toThrow(InvalidTwoStepStateError);
    expect(enabled().recordRightAnswer(null).lastAcceptedTimeStep).toBe(100);
  });

  it('replaces the app with its own accepted step, keeping the handle and the backup codes', () => {
    const replaced: TwoStepVerification = enabled().replaceAuthenticatorApp(
      'k1.other.ciphertext.tag',
      90,
      NOW,
    );

    expect(replaced.snapshot).toMatchObject({
      sealedSecret: 'k1.other.ciphertext.tag',
      authenticatorConfiguredAt: NOW,
      lastAcceptedTimeStep: 90,
      webauthnUserHandle: 'handle-of-camille',
      backupCodesGeneratedAt: ENABLED_AT,
      enabledAt: ENABLED_AT,
    });
  });

  it('refuses a stored state out of its bounds', () => {
    expect(() => TwoStepVerification.restore({ ...enabled().snapshot, failedAnswers: 6 })).toThrow(
      InvalidTwoStepStateError,
    );
    expect(() =>
      TwoStepVerification.restore({ ...enabled().snapshot, lastAcceptedTimeStep: -1 }),
    ).toThrow(InvalidTwoStepStateError);
    expect(() => TwoStepVerification.restore({ ...enabled().snapshot, sealedSecret: '' })).toThrow(
      InvalidTwoStepStateError,
    );
  });
});
