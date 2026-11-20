import { describe, expect, it } from 'vitest';

import { EmailAlreadyVerifiedError } from '../../errors/accounts/email-already-verified.error.js';
import { EmailUnchangedError } from '../../errors/accounts/email-unchanged.error.js';
import { InvalidUserNameError } from '../../errors/accounts/invalid-user-name.error.js';
import { InvalidProfileError } from '../../errors/accounts/invalid-profile.error.js';
import { InvalidUserStateError } from '../../errors/accounts/invalid-user-state.error.js';
import { SignUpReplacedError } from '../../errors/accounts/sign-up-replaced.error.js';
import { DeletionAlreadyScheduledError } from '../../errors/deletion/deletion-already-scheduled.error.js';
import { EmailAddress } from '../../value-objects/email/email-address.value-object.js';
import { AvatarUpload } from '../avatar-upload/avatar-upload.aggregate.js';
import type { UserRegistration } from './user-registration.aggregate.js';
import type { UserState } from './user-state.aggregate.js';
import { User } from './user.aggregate.js';

/** When the sign-ups of the specs set the password. */
const SIGNED_UP_AT: Date = new Date('2026-11-08T13:07:00Z');
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
    passwordChangedAt: new Date('2026-11-08T13:00:00Z'),
    deleteAt: null,
  });
}

describe('User', () => {
  it('registers an unverified account at version 1, in French, with the name trimmed', () => {
    const registration: UserRegistration = User.register(
      CAMILLE,
      '  Camille Martin ',
      SIGNED_UP_AT,
    );

    expect(registration).toEqual({
      email: CAMILLE,
      name: 'Camille Martin',
      language: 'fr',
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
      version: 1,
      signUpCount: 1,
      passwordChangedAt: SIGNED_UP_AT,
    });
  });

  it('refuses a name of spaces only, and one longer than 120 characters', () => {
    expect(() => User.register(CAMILLE, '   ', SIGNED_UP_AT)).toThrow(InvalidUserNameError);
    expect(() => User.register(CAMILLE, 'C'.repeat(121), SIGNED_UP_AT)).toThrow(
      InvalidUserNameError,
    );
  });

  it('signs an unverified account up again with the new name, the next version and one more sign-up', () => {
    const again: User = unverified().replaceRegistration('Camille M.', SIGNED_UP_AT);

    expect(again.id).toBe('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30');
    expect(again.name).toBe('Camille M.');
    expect(again.version).toBe(2);
    expect(again.signUpCount).toBe(2);
    expect(again.isVerified).toBe(false);
    expect(again.replaceRegistration('Camille Martin', SIGNED_UP_AT).signUpCount).toBe(3);
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
      unverified().replaceRegistration('Camille M.', SIGNED_UP_AT).verifyEmail(now, 'differs'),
    ).toThrow(SignUpReplacedError);
  });

  it('requires the password of the latest sign-up once a later sign-up replaced the pending account', () => {
    const now: Date = new Date('2026-11-08T13:08:00Z');
    const replaced: User = unverified().replaceRegistration('Camille M.', SIGNED_UP_AT);

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

    expect(() => verified.replaceRegistration('Camille Martin', SIGNED_UP_AT)).toThrow(
      EmailAlreadyVerifiedError,
    );
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
      passwordChangedAt: new Date('2026-11-08T13:00:00Z'),
      deleteAt: null,
    };

    expect(() => User.restore({ ...stored, version: 0 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, version: 1.5 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, signUpCount: 0 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, signUpCount: 1.5 })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, language: '' })).toThrow(InvalidUserStateError);
    expect(() => User.restore({ ...stored, timeZone: '' })).toThrow(InvalidUserStateError);
  });

  it('registers an account without display name nor job title, in the time zone of Paris', () => {
    expect(User.register(CAMILLE, 'Camille Martin', SIGNED_UP_AT)).toMatchObject({
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

describe('User avatar', () => {
  const firstId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
  const secondId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b02';
  const now = new Date('2026-11-20T09:00:00.000Z');

  function reserve(user: User, id: string = firstId): AvatarUpload {
    return AvatarUpload.reserve({
      id,
      userId: user.id,
      generation: user.avatarGeneration,
      now,
      contentType: 'image/png',
      sizeBytes: 48_292,
    });
  }

  it('reads an account stored before avatars without an image reference', () => {
    expect(unverified().avatarId).toBeNull();
    expect(unverified().avatarGeneration).toBe(0);
  });

  it('publishes an opaque avatar and increments the avatar generation and account version', () => {
    const user = unverified();
    const result = user.publishAvatar(reserve(user), now, user.version);

    expect(result.user.avatarId).toBe(firstId);
    expect(result.user.avatarGeneration).toBe(1);
    expect(result.user.version).toBe(user.version + 1);
    expect(result.upload.snapshot.status).toBe('committed');
    expect(result.change).toEqual({
      userId: user.id,
      generation: 1,
      assetId: firstId,
      oldAssetId: null,
    });
  });

  it('refuses stale preconditions without changing the account or consuming a pending upload', () => {
    const user = unverified().updateProfile({ displayName: 'Camille' }).user;
    const pending = reserve(user);

    expect(() => user.publishAvatar(pending, now, user.version - 1)).toThrow(
      expect.objectContaining({ reason: 'version-mismatch' }),
    );
    expect(() => user.clearAvatar(user.version - 1)).toThrow(
      expect.objectContaining({ reason: 'version-mismatch' }),
    );
    expect(user.avatarId).toBeNull();
    expect(pending.snapshot.status).toBe('pending');
  });

  it('keeps the previous image active until a replacement is adopted and fences competing uploads', () => {
    const user = unverified();
    const initial = user.publishAvatar(reserve(user), now);
    const competing = reserve(initial.user, '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b03');
    const replacement = reserve(initial.user, secondId);

    expect(initial.user.avatarId).toBe(firstId);
    const replaced = initial.user.publishAvatar(replacement, now);
    expect(replaced.change).toEqual({
      userId: user.id,
      generation: 2,
      assetId: secondId,
      oldAssetId: firstId,
    });
    expect(() => replaced.user.publishAvatar(competing, now)).toThrow(
      expect.objectContaining({ reason: 'superseded' }),
    );
  });

  it('replays a committed upload against the current account after removal without reinstating it', () => {
    const user = unverified();
    const first = user.publishAvatar(reserve(user), now);
    const cleared = first.user.clearAvatar();

    expect(cleared.user.avatarId).toBeNull();
    expect(cleared.user.version).toBe(first.user.version + 1);
    expect(cleared.change).toEqual({
      userId: user.id,
      generation: 2,
      assetId: null,
      oldAssetId: firstId,
    });
    const staleReplay = cleared.user.publishAvatar(first.upload, new Date('2026-11-21'), 1);
    expect(staleReplay).toEqual({ user: cleared.user, upload: first.upload, change: null });
  });

  it('fences pending reservations on removal even when there was no active avatar', () => {
    const user = unverified();
    const pending = reserve(user);
    const cleared = user.clearAvatar(user.version);

    expect(cleared.user.version).toBe(user.version);
    expect(cleared.user.avatarGeneration).toBe(user.avatarGeneration + 1);
    expect(cleared.change).toBeNull();
    expect(() => cleared.user.publishAvatar(pending, now)).toThrow(
      expect.objectContaining({ reason: 'superseded' }),
    );
    const next = reserve(cleared.user, secondId);
    expect(cleared.user.publishAvatar(next, now).user.avatarId).toBe(secondId);
  });
});

/**
 * Constant NOW
 *
 * @description
 * The instant of the changes of the security specs.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-09T13:16:00Z');

/**
 * Function verified
 *
 * @description
 * The verified account of Camille Martin, at version 2.
 *
 * @returns {User} The account.
 */
function verified(): User {
  return unverified().verifyEmail(new Date('2026-11-08T13:08:00Z'), 'not-sent');
}

describe('User security', () => {
  it('records a new password with the next version and its instant', () => {
    const account: User = verified();
    const changed: User = account.changePassword(NOW);

    expect(changed.passwordChangedAt).toEqual(NOW);
    expect(changed.version).toBe(account.version + 1);
    expect(changed.email).toBe(account.email);
    expect(account.passwordChangedAt).toEqual(new Date('2026-11-08T13:00:00Z'));
  });

  it('sets the password at the sign-up and at a later sign-up of the pending account', () => {
    expect(User.register(CAMILLE, 'Camille Martin', SIGNED_UP_AT).passwordChangedAt).toEqual(
      SIGNED_UP_AT,
    );
    expect(unverified().replaceRegistration('Camille M.', NOW).passwordChangedAt).toEqual(NOW);
  });

  it('refuses a change of address to the current address, whatever its case', () => {
    const account: User = verified();

    expect(() => {
      account.assertNewEmail(EmailAddress.of(' Camille.Martin@AtelierNord.fr '));
    }).toThrow(EmailUnchangedError);
    expect(() => account.changeEmail(CAMILLE, NOW)).toThrow(EmailUnchangedError);
    expect(() => {
      account.assertNewEmail(EmailAddress.of('camille@ateliernord.fr'));
    }).not.toThrow();
  });

  it('makes a new address the verified address with the next version', () => {
    const account: User = verified();
    const changed: User = account.changeEmail(EmailAddress.of('camille@ateliernord.fr'), NOW);

    expect(changed.email.value).toBe('camille@ateliernord.fr');
    expect(changed.emailVerifiedAt).toEqual(NOW);
    expect(changed.isVerified).toBe(true);
    expect(changed.version).toBe(account.version + 1);
    expect(changed.id).toBe(account.id);
  });

  it('schedules the deletion 30 days ahead with the next version, once', () => {
    const account: User = verified();
    const scheduled: User = account.scheduleDeletion(NOW);

    expect(scheduled.deleteAt).toEqual(new Date('2026-12-09T13:16:00Z'));
    expect(scheduled.version).toBe(account.version + 1);
    expect(() => scheduled.scheduleDeletion(NOW)).toThrow(DeletionAlreadyScheduledError);
  });

  it('cancels a scheduled deletion with the next version, and returns an account without one as it is', () => {
    const account: User = verified();
    const scheduled: User = account.scheduleDeletion(NOW);
    const cancelled: User = scheduled.cancelDeletion();

    expect(cancelled.deleteAt).toBeNull();
    expect(cancelled.version).toBe(scheduled.version + 1);
    expect(account.cancelDeletion()).toBe(account);
  });

  it('tells a deletion due from its deleteAt on, and never without one', () => {
    const scheduled: User = verified().scheduleDeletion(NOW);
    const deleteAt: number = new Date('2026-12-09T13:16:00Z').getTime();

    expect(scheduled.isDeletionDueAt(new Date(deleteAt - 1))).toBe(false);
    expect(scheduled.isDeletionDueAt(new Date(deleteAt))).toBe(true);
    expect(scheduled.isDeletionDueAt(new Date(deleteAt + 60_000))).toBe(true);
    expect(verified().isDeletionDueAt(new Date(deleteAt + 60_000))).toBe(false);
  });

  it('refuses a stored unverified account with a scheduled deletion', () => {
    const stored: UserState = {
      id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      email: CAMILLE,
      name: 'Camille Martin',
      language: 'fr',
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
      emailVerifiedAt: null,
      version: 3,
      signUpCount: 1,
      passwordChangedAt: SIGNED_UP_AT,
      deleteAt: new Date('2026-12-09T13:16:00Z'),
    };

    expect(() => User.restore(stored)).toThrow(InvalidUserStateError);
    expect(
      User.restore({ ...stored, emailVerifiedAt: new Date('2026-11-08T13:08:00Z') }).deleteAt,
    ).toEqual(new Date('2026-12-09T13:16:00Z'));
  });
});
