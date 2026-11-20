import { describe, expect, it, vi } from 'vitest';

import { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { AvatarStore } from '../../../../ports/outbound/transactions/avatar/avatar-store.port.js';
import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import { ReserveAvatarUpload } from './reserve-avatar-upload.use-case.js';

const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const uploadId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
const now = new Date('2026-11-20T09:00:00Z');

function user(): User {
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

describe('ReserveAvatarUpload', () => {
  it('returns the original expired receipt for an identical replay without another allocation', async () => {
    const state: { upload?: Parameters<AvatarStore['insertUpload']>[0] } = {};
    const mocks = {
      lockUser: vi.fn().mockResolvedValue(user()),
      findByIdempotencyKey: vi.fn().mockImplementation(() => Promise.resolve(state.upload ?? null)),
      newUploadId: vi.fn().mockResolvedValue(uploadId),
      insertUpload: vi
        .fn()
        .mockImplementation((upload: Parameters<AvatarStore['insertUpload']>[0]) => {
          state.upload = upload;
          return Promise.resolve();
        }),
    };
    const store = mocks as unknown as AvatarStore;
    const work: AvatarUnitOfWork = { run: (operation) => operation(store) };
    const clock = vi.fn().mockReturnValue(now);
    const useCase = new ReserveAvatarUpload(work, clock);
    const input = {
      actorUserId: userId,
      userId,
      contentType: 'image/webp',
      sizeBytes: 2048,
      idempotencyKey: 'fixture',
    };
    const first = await useCase.execute(input);
    clock.mockReturnValue(new Date(first.expiresAt.getTime() + 1));
    expect(await useCase.execute(input)).toEqual(first);
    expect(mocks.newUploadId).toHaveBeenCalledOnce();
    expect(mocks.insertUpload).toHaveBeenCalledOnce();
    await expect(useCase.execute({ ...input, sizeBytes: 2049 })).rejects.toMatchObject({
      reason: 'key-reused',
    });
  });

  it('refuses another actor before loading an account', async () => {
    const mocks = { lockUser: vi.fn() };
    const store = mocks as unknown as AvatarStore;
    const work: AvatarUnitOfWork = { run: (operation) => operation(store) };
    await expect(
      new ReserveAvatarUpload(work, () => now).execute({
        actorUserId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31',
        userId,
        contentType: 'image/png',
        sizeBytes: 2048,
      }),
    ).rejects.toMatchObject({ refusal: { reason: 'user-not-found' } });
    expect(mocks.lockUser).not.toHaveBeenCalled();
  });
});
