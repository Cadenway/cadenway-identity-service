import { describe, expect, it, vi } from 'vitest';

import { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { AvatarUpload } from '../../../../../domain/aggregates/avatar-upload/avatar-upload.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { AvatarStore } from '../../../../ports/outbound/transactions/avatar/avatar-store.port.js';
import type { AvatarUnitOfWork } from '../../../../ports/outbound/transactions/avatar/avatar-unit-of-work.port.js';
import { AbandonAvatarUpload } from './abandon-avatar-upload.use-case.js';

const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const uploadId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
const now = new Date('2026-11-20T09:00:00Z');

describe('AbandonAvatarUpload', () => {
  it('persists a single terminal decision and its cleanup fact once the lease expires', async () => {
    const user = User.restore({
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
    let upload = AvatarUpload.reserve({
      id: uploadId,
      userId,
      generation: 0,
      contentType: 'image/png',
      sizeBytes: 100,
      now,
    });
    const mocks = {
      lockUser: vi.fn().mockResolvedValue(user),
      lockUpload: vi.fn().mockImplementation(() => Promise.resolve(upload)),
      saveUpload: vi.fn().mockImplementation((next: AvatarUpload) => {
        upload = next;
        return Promise.resolve();
      }),
      appendAbandoned: vi.fn().mockResolvedValue(undefined),
    };
    const store = mocks as unknown as AvatarStore;
    const work: AvatarUnitOfWork = { run: (operation) => operation(store) };
    const useCase = new AbandonAvatarUpload(work, () => new Date(now.getTime() + 300_000));
    expect(await useCase.execute({ userId, uploadId })).toBe(true);
    expect(await useCase.execute({ userId, uploadId })).toBe(false);
    expect(mocks.appendAbandoned).toHaveBeenCalledExactlyOnceWith({ userId, uploadId });
    expect(upload.snapshot.status).toBe('expired');
  });
});
