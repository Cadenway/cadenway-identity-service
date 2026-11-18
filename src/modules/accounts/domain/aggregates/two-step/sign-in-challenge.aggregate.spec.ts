import { describe, expect, it } from 'vitest';

import { InvalidTwoStepStateError } from '../../errors/two-step/invalid-two-step-state.error.js';
import type { SignInChallengeIssue } from './sign-in-challenge-issue.aggregate.js';
import { SignInChallenge } from './sign-in-challenge.aggregate.js';

/**
 * Constant NOW
 *
 * @description
 * The instant of the right password of Camille Martin.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-09T07:37:00Z');

/**
 * Function issued
 *
 * @description
 * The challenge of that sign-in, as stored.
 *
 * @returns {SignInChallenge} The challenge.
 */
function issued(): SignInChallenge {
  const issue: SignInChallengeIssue = SignInChallenge.issue(
    '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
    'hash-of-the-token',
    true,
    NOW,
  );
  return SignInChallenge.restore({
    ...issue,
    id: '019a6c52-1d2e-7f3a-8b4c-5d6e7f8a9b10',
    assertionChallenge: null,
    assertionExpiresAt: null,
  });
}

describe('SignInChallenge', () => {
  it('lasts 10 minutes and keeps the rememberMe of the sign-in', () => {
    const challenge: SignInChallenge = issued();

    expect(challenge.expiresAt).toEqual(new Date('2026-11-09T07:47:00Z'));
    expect(challenge.persistent).toBe(true);
    expect(challenge.isUsableAt(new Date('2026-11-09T07:46:59Z'))).toBe(true);
    expect(challenge.isUsableAt(new Date('2026-11-09T07:47:00Z'))).toBe(false);
  });

  it('keeps the WebAuthn challenge of its latest options for 5 minutes', () => {
    const challenge: SignInChallenge = issued()
      .withAssertion('first-webauthn-challenge', NOW)
      .withAssertion('latest-webauthn-challenge', new Date('2026-11-09T07:38:00Z'));

    expect(issued().assertionChallengeAt(NOW)).toBeNull();
    expect(challenge.assertionChallengeAt(new Date('2026-11-09T07:42:59Z'))).toBe(
      'latest-webauthn-challenge',
    );
    expect(challenge.assertionChallengeAt(new Date('2026-11-09T07:43:00Z'))).toBeNull();
  });

  it('refuses a stored WebAuthn challenge without its expiry', () => {
    expect(() =>
      SignInChallenge.restore({ ...issued().snapshot, assertionChallenge: 'orphan' }),
    ).toThrow(InvalidTwoStepStateError);
  });
});
