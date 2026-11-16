import { describe, expect, it } from 'vitest';

import { EmailAlreadyVerifiedError } from '../../errors/accounts/email-already-verified.error.js';
import { InvalidUserNameError } from '../../errors/accounts/invalid-user-name.error.js';
import { InvalidUserStateError } from '../../errors/accounts/invalid-user-state.error.js';
import { SignUpReplacedError } from '../../errors/accounts/sign-up-replaced.error.js';
import { EmailAddress } from '../../value-objects/email/email-address.value-object.js';
import type { UserRegistration } from './user-registration.aggregate.js';
import type { UserState } from './user-state.aggregate.js';
import { User } from './user.aggregate.js';

/**
 * Constant CAMILLE
 *
 * @description
 * The address of Camille Martin, of Atelier Nord.
 *
 * @type {EmailAddress}
 */
const CAMILLE: EmailAddress = EmailAddress.of('camille.martin@ateliernord.fr');

/**
 * Function unverified
 *
 * @description
 * The stored, unverified account of Camille Martin.
 *
 * @returns {User} The account.
 */
function unverified(): User {
  return User.restore({
    id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
    email: CAMILLE,
    name: 'Camille Martin',
    language: 'fr',
    emailVerifiedAt: null,
    version: 1,
    signUpCount: 1,
  });
}

describe('User', () => {
  it('registers an unverified account at version 1, in French, with the name trimmed', () => {
    const registration: UserRegistration = User.register(CAMILLE, '  Camille Martin ');

    expect(registration).toEqual({
      email: CAMILLE,
      name: 'Camille Martin',
      language: 'fr',
      version: 1,
      signUpCount: 1,
    });
  });

  it('refuses a name of spaces only, and one longer than 120 characters', () => {
    expect(() => User.register(CAMILLE, '   ')).toThrow(InvalidUserNameError);
    expect(() => User.register(CAMILLE, 'C'.repeat(121))).toThrow(InvalidUserNameError);
  });

  it('signs an unverified account up again with the new name, the next version and one more sign-up', () => {
    const again: User = unverified().replaceRegistration('Camille M.');

    expect(again.id).toBe('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30');
    expect(again.name).toBe('Camille M.');
    expect(again.version).toBe(2);
    expect(again.signUpCount).toBe(2);
    expect(again.isVerified).toBe(false);
    expect(again.replaceRegistration('Camille Martin').signUpCount).toBe(3);
  });

  it('verifies the address once, with the next version', () => {
    const now: Date = new Date('2026-11-08T13:08:00Z');
    const verified: User = unverified().verifyEmail(now, 'matches');

    expect(verified.isVerified).toBe(true);
    expect(verified.emailVerifiedAt).toEqual(now);
    expect(verified.version).toBe(2);
    expect(verified.signUpCount).toBe(1);
    expect(() => verified.verifyEmail(now, 'matches')).toThrow(EmailAlreadyVerifiedError);
  });

  it('verifies an address signed up once by its code alone', () => {
    const now: Date = new Date('2026-11-08T13:08:00Z');

    expect(unverified().verifyEmail(now, 'not-sent').isVerified).toBe(true);
  });

  it('refuses a verification whose password differs from the one of the latest sign-up', () => {
    const now: Date = new Date('2026-11-08T13:08:00Z');

    expect(() => unverified().verifyEmail(now, 'differs')).toThrow(SignUpReplacedError);
    expect(() =>
      unverified().replaceRegistration('Camille M.').verifyEmail(now, 'differs'),
    ).toThrow(SignUpReplacedError);
  });

  it('requires the password of the latest sign-up once a later sign-up replaced the pending account', () => {
    const now: Date = new Date('2026-11-08T13:08:00Z');
    const replaced: User = unverified().replaceRegistration('Camille M.');

    expect(() => {
      replaced.assertProvesSignUp('not-sent');
    }).toThrow(SignUpReplacedError);
    expect(() => replaced.verifyEmail(now, 'not-sent')).toThrow(SignUpReplacedError);
    expect(replaced.verifyEmail(now, 'matches').isVerified).toBe(true);
    expect(() => {
      unverified().assertProvesSignUp('not-sent');
    }).not.toThrow();
  });

  it('refuses to sign a verified account up again', () => {
    const verified: User = unverified().verifyEmail(new Date('2026-11-08T13:08:00Z'), 'not-sent');

    expect(() => verified.replaceRegistration('Camille Martin')).toThrow(EmailAlreadyVerifiedError);
  });

  it('refuses a stored account without a positive version, a positive sign-up count or a language', () => {
    const stored: UserState = {
      id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      email: CAMILLE,
      name: 'Camille Martin',
      language: 'fr',
      emailVerifiedAt: null,
      version: 1,
      signUpCount: 1,
    };

    expect(() => User.restore({ ...stored, version: 0 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, version: 1.5 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, signUpCount: 0 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, signUpCount: 1.5 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, language: '' })).toThrow(InvalidUserStateError);
  });
});
