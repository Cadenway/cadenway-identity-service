import { describe, expect, it } from 'vitest';

import { EmailAddress } from './email-address.js';
import {
  EmailAlreadyVerifiedError,
  InvalidUserNameError,
  InvalidUserStateError,
} from './errors.js';
import { User } from './user.js';
import type { UserRegistration, UserState } from './user.js';

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
    });
  });

  it('refuses a name of spaces only, and one longer than 120 characters', () => {
    expect(() => User.register(CAMILLE, '   ')).toThrow(InvalidUserNameError);
    expect(() => User.register(CAMILLE, 'C'.repeat(121))).toThrow(InvalidUserNameError);
  });

  it('signs an unverified account up again with the new name and the next version', () => {
    const again: User = unverified().replaceRegistration('Camille M.');

    expect(again.id).toBe('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30');
    expect(again.name).toBe('Camille M.');
    expect(again.version).toBe(2);
    expect(again.isVerified).toBe(false);
  });

  it('verifies the address once, with the next version', () => {
    const now: Date = new Date('2026-11-08T13:08:00Z');
    const verified: User = unverified().verifyEmail(now);

    expect(verified.isVerified).toBe(true);
    expect(verified.emailVerifiedAt).toEqual(now);
    expect(verified.version).toBe(2);
    expect(() => verified.verifyEmail(now)).toThrow(EmailAlreadyVerifiedError);
  });

  it('refuses to sign a verified account up again', () => {
    const verified: User = unverified().verifyEmail(new Date('2026-11-08T13:08:00Z'));

    expect(() => verified.replaceRegistration('Camille Martin')).toThrow(EmailAlreadyVerifiedError);
  });

  it('refuses a stored account without a positive version or a language', () => {
    const stored: UserState = {
      id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      email: CAMILLE,
      name: 'Camille Martin',
      language: 'fr',
      emailVerifiedAt: null,
      version: 1,
    };

    expect(() => User.restore({ ...stored, version: 0 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, version: 1.5 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, language: '' })).toThrow(InvalidUserStateError);
  });
});
