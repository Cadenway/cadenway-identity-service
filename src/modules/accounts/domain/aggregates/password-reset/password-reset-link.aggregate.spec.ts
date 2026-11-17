import { describe, expect, it } from 'vitest';

import { ResetLinkUnusableError } from '../../errors/password-reset/reset-link-unusable.error.js';
import type { PasswordResetLinkIssue } from './password-reset-link-issue.aggregate.js';
import type { PasswordResetLinkState } from './password-reset-link-state.aggregate.js';
import { PasswordResetLink } from './password-reset-link.aggregate.js';

/**
 * Constant ISSUED_AT
 *
 * @description
 * When the link of the specs was issued ("Mot de passe oublié" of Camille Martin).
 *
 * @type {Date}
 */
const ISSUED_AT: Date = new Date('2026-11-09T13:10:00Z');

/**
 * Constant MINUTE
 *
 * @description
 * One minute, in milliseconds.
 *
 * @type {number}
 */
const MINUTE: number = 60_000;

/**
 * Function stored
 *
 * @description
 * The link of the specs as the repository stores it.
 *
 * @param {Partial<PasswordResetLinkState>} changes - Members that differ from a fresh link.
 * @returns {PasswordResetLink} The link.
 */
function stored(changes: Partial<PasswordResetLinkState> = {}): PasswordResetLink {
  const issue: PasswordResetLinkIssue = PasswordResetLink.issue(
    '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
    'hash:token',
    ISSUED_AT,
  );
  return PasswordResetLink.restore({
    ...issue,
    id: '019a6b44-0a1b-7c2d-8e3f-4a5b6c7d8e07',
    usedAt: null,
    replacedAt: null,
    ...changes,
  });
}

describe('PasswordResetLink', () => {
  it('issues a link of the account that stops working 30 minutes later', () => {
    expect(
      PasswordResetLink.issue('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30', 'hash:token', ISSUED_AT),
    ).toEqual({
      userId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      tokenHash: 'hash:token',
      expiresAt: new Date('2026-11-09T13:40:00Z'),
    });
    expect(PasswordResetLink.expiryFor(ISSUED_AT)).toEqual(new Date('2026-11-09T13:40:00Z'));
  });

  it('works until the 30 minutes have passed', () => {
    const link: PasswordResetLink = stored();

    expect(link.worksAt(new Date(ISSUED_AT.getTime() + 30 * MINUTE - 1))).toBe(true);
    expect(link.worksAt(new Date(ISSUED_AT.getTime() + 30 * MINUTE))).toBe(false);
  });

  it('works once: a used link never works again', () => {
    const now: Date = new Date(ISSUED_AT.getTime() + 5 * MINUTE);
    const used: PasswordResetLink = stored().use(now);

    expect(used.snapshot.usedAt).toEqual(now);
    expect(used.worksAt(now)).toBe(false);
    expect(() => used.use(now)).toThrow(ResetLinkUnusableError);
  });

  it('refuses a link a newer one replaced, and an expired one', () => {
    const now: Date = new Date(ISSUED_AT.getTime() + 5 * MINUTE);
    const replaced: PasswordResetLink = stored({ replacedAt: now });

    expect(replaced.worksAt(now)).toBe(false);
    expect(() => replaced.use(now)).toThrow(ResetLinkUnusableError);
    expect(() => stored().use(new Date(ISSUED_AT.getTime() + 31 * MINUTE))).toThrow(
      ResetLinkUnusableError,
    );
  });
});
