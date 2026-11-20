import { describe, expect, it, vi } from 'vitest';

import { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { AvatarUpload } from '../../../../../domain/aggregates/avatar-upload/avatar-upload.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { AvatarStore } from '../../../../ports/outbound/transactions/avatar/avatar-store.port.js';
import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import { PublishAvatar } from './publish-avatar.use-case.js';

const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const uploadId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
const now = new Date('2026-11-20T09:00:00Z');

function account(): User {
  return User.restore({
    id: userId,
    email: EmailAddress.of('camille.martin@ateliernord.fr'),
    name: 'Camille Martin',
    language: 'fr',
    displayName: null,
    jobTitle: null,
    timeZone: 'Europe/Paris',
    emailVerifiedAt: null,
    version: 1,
    signUpCount: 1,
    passwordChangedAt: now,
    deleteAt: null,
  });
}

describe('PublishAvatar', () => {
  it('persists the owner and upload before appending the change in one transaction', async () => {
    const upload = AvatarUpload.reserve({
      id: uploadId,
      userId,
      generation: 0,
      contentType: 'image/png',
      sizeBytes: 100,
      now,
    });
    const mocks = {
      lockUser: vi.fn().mockResolvedValue(account()),
      lockUpload: vi.fn().mockResolvedValue(upload),
      saveAvatar: vi.fn().mockResolvedValue(undefined),
      saveUpload: vi.fn().mockResolvedValue(undefined),
      appendChanged: vi.fn().mockResolvedValue(undefined),
    };
    const store = mocks as unknown as AvatarStore;
    const work: AvatarUnitOfWork = { run: (operation) => operation(store) };
    const result = await new PublishAvatar(work, () => now).execute({
      actorUserId: userId,
      userId,
      uploadId,
      expectedVersion: 1,
    });
    expect(result.version).toBe(2);
    expect(mocks.saveAvatar).toHaveBeenCalledOnce();
    expect(mocks.saveUpload).toHaveBeenCalledOnce();
    expect(mocks.appendChanged).toHaveBeenCalledOnce();
    expect(mocks.saveUpload.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.appendChanged.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('returns the current version for a committed replay, even with a stale If-Match', async () => {
    const user = account();
    const upload = AvatarUpload.reserve({
      id: uploadId,
      userId,
      generation: 0,
      contentType: 'image/png',
      sizeBytes: 100,
      now,
    });
    const published = user.publishAvatar(upload, now, 1);
    const mocks = {
      lockUser: vi.fn().mockResolvedValue(published.user),
      lockUpload: vi.fn().mockResolvedValue(published.upload),
      saveAvatar: vi.fn(),
      saveUpload: vi.fn(),
      appendChanged: vi.fn(),
    };
    const store = mocks as unknown as AvatarStore;
    const work: AvatarUnitOfWork = { run: (operation) => operation(store) };
    expect(
      await new PublishAvatar(work, () => now).execute({
        actorUserId: userId,
        userId,
        uploadId,
        expectedVersion: 1,
      }),
    ).toEqual({ version: 2 });
    expect(mocks.saveAvatar).not.toHaveBeenCalled();
    expect(mocks.saveUpload).not.toHaveBeenCalled();
    expect(mocks.appendChanged).not.toHaveBeenCalled();
  });
});
