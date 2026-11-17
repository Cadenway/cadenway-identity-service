import { describe, expect, it } from 'vitest';

import { EmailAlreadyVerifiedError } from '../../errors/accounts/email-already-verified.error.js';
import { InvalidUserNameError } from '../../errors/accounts/invalid-user-name.error.js';
import { InvalidProfileError } from '../../errors/accounts/invalid-profile.error.js';
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
    displayName: null,
    jobTitle: null,
    timeZone: 'Europe/Paris',
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
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
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
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
      emailVerifiedAt: null,
      version: 1,
      signUpCount: 1,
    };

    expect(() => User.restore({ ...stored, version: 0 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, version: 1.5 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, signUpCount: 0 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, signUpCount: 1.5 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, language: '' })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, timeZone: '' })).toThrow(InvalidUserStateError);
  });

  it('registers an account without display name nor job title, in the time zone of Paris', () => {
    expect(User.register(CAMILLE, 'Camille Martin')).toMatchObject({
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
    });
  });

  it('updates the members of the profile a patch gives, trimmed, with the next version', () => {
    const update = unverified().updateProfile({
      displayName: ' camille ',
      jobTitle: 'Responsable produit',
      timeZone: 'America/Montreal',
    });

    expect(update.changed).toEqual(['displayName', 'jobTitle', 'timeZone']);
    expect(update.user).toMatchObject({
      name: 'Camille Martin',
      displayName: 'camille',
      jobTitle: 'Responsable produit',
      timeZone: 'America/Montreal',
      language: 'fr',
      version: 2,
    });
  });

  it('clears the display name and the job title with null, and keeps what the patch leaves out', () => {
    const named: User = unverified().updateProfile({
      displayName: 'camille',
      jobTitle: 'CTO',
    }).user;
    const cleared = named.updateProfile({ displayName: null, jobTitle: null, language: 'en' });

    expect(cleared.changed).toEqual(['displayName', 'jobTitle', 'language']);
    expect(cleared.user).toMatchObject({ displayName: null, jobTitle: null, language: 'en' });
    expect(cleared.user.timeZone).toBe('Europe/Paris');
    expect(cleared.user.version).toBe(3);
  });

  it('changes nothing, and keeps the version, for a patch that moves nothing', () => {
    const account: User = unverified();
    const update = account.updateProfile({ name: ' Camille Martin ', language: 'fr' });

    expect(update.changed).toEqual([]);
    expect(update.user).toBe(account);
    expect(account.updateProfile({}).user).toBe(account);
  });

  it('refuses a blank or too long name, display name or job title', () => {
    const account: User = unverified();

    expect(() => account.updateProfile({ name: '  ' })).toThrow(InvalidUserNameError);
    expect(() => account.updateProfile({ displayName: '   ' })).toThrow(InvalidProfileError);
    expect(() => account.updateProfile({ displayName: 'x'.repeat(61) })).toThrow(
      InvalidProfileError,
    );
    expect(() => account.updateProfile({ jobTitle: 'x'.repeat(121) })).toThrow(InvalidProfileError);
    expect(() => account.updateProfile({ timeZone: '' })).toThrow(InvalidProfileError);
  });
});
