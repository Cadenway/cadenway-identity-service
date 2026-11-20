import { describe, expect, it } from 'vitest';

import { AvatarRefusal } from '../../errors/avatar/avatar-refusal.error.js';
import { AvatarUpload } from './avatar-upload.aggregate.js';

const userId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const anotherUser = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const uploadId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
const reservedAt = new Date('2026-11-20T09:00:00.000Z');
const expiresAt = new Date('2026-11-20T09:05:00.000Z');
const context = { userId, generation: 2, now: reservedAt };
const declaration = { contentType: 'image/webp', sizeBytes: 5_242_880 };

function reserve(): AvatarUpload {
  return AvatarUpload.reserve({ id: uploadId, ...declaration, ...context });
}

describe('AvatarUpload', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])(
    'binds a %s declaration to the account and its current avatar generation',
    (contentType) => {
      const upload = AvatarUpload.reserve({
        id: uploadId.toUpperCase(),
        ...declaration,
        ...context,
        contentType,
      });

      expect(upload.snapshot).toEqual({
        id: uploadId,
        userId,
        generation: 2,
        contentType,
        sizeBytes: declaration.sizeBytes,
        expiresAt,
        status: 'pending',
      });
    },
  );

  it('reserves the exact second the signed transfer can represent without extending its lifetime', () => {
    const upload = AvatarUpload.reserve({
      id: uploadId,
      ...declaration,
      ...context,
      now: new Date('2026-11-20T09:00:00.789Z'),
    });

    expect(upload.snapshot.expiresAt).toEqual(expiresAt);
  });

  it('refuses a declaration above 5 MiB or without an accepted image content type', () => {
    expect(() =>
      AvatarUpload.reserve({
        id: uploadId,
        ...context,
        ...declaration,
        sizeBytes: declaration.sizeBytes + 1,
      }),
    ).toThrow(expect.objectContaining({ reason: 'file-too-large' }));
    expect(() =>
      AvatarUpload.reserve({
        id: uploadId,
        ...context,
        ...declaration,
        contentType: 'image/svg+xml',
      }),
    ).toThrow(expect.objectContaining({ reason: 'unsupported-type' }));
  });

  it('compares a replay declaration in its account without extending the original expiry', () => {
    const upload = reserve();

    expect(() => {
      upload.assertEquivalent(userId.toUpperCase(), declaration);
    }).not.toThrow();
    expect(() => {
      upload.assertEquivalent(userId, { ...declaration, sizeBytes: 1 });
    }).toThrow(expect.objectContaining({ reason: 'key-reused' }));
    expect(() => {
      upload.assertEquivalent(anotherUser, declaration);
    }).toThrow(expect.objectContaining({ reason: 'not-found' }));
    expect(upload.snapshot.expiresAt).toEqual(expiresAt);
  });

  it('requires a live owner reservation for first preparation or publication', () => {
    const upload = reserve();

    expect(upload.readStatus({ ...context, now: new Date(expiresAt.getTime() - 1) })).toBe(
      'pending',
    );
    expect(() => upload.readStatus({ ...context, now: expiresAt })).toThrow(
      expect.objectContaining({ reason: 'expired' }),
    );
    expect(() => upload.commit({ ...context, generation: 3 })).toThrow(
      expect.objectContaining({ reason: 'superseded' }),
    );
    expect(() => upload.commit({ ...context, userId: anotherUser })).toThrow(
      expect.objectContaining({ reason: 'not-found' }),
    );
  });

  it('keeps a committed receipt readable but never reopens it after expiry or replacement', () => {
    const committed = reserve().commit(context);
    const replay = { userId, now: expiresAt, generation: 3 };

    expect(committed.readStatus(replay)).toBe('committed');
    expect(committed.commit(replay)).toBe(committed);
    expect(committed.abandonIfUnusable(replay)).toBeNull();
    expect(() => committed.readStatus({ ...replay, userId: anotherUser })).toThrow(
      expect.objectContaining({ reason: 'not-found' }),
    );
  });

  it.each([
    { reason: 'expired', expiredContext: { ...context, now: expiresAt } },
    { reason: 'superseded', expiredContext: { ...context, generation: 3 } },
  ])(
    'records the $reason decision once with only opaque identifiers',
    ({ reason, expiredContext }) => {
      const upload = reserve();
      const ended = upload.abandonIfUnusable(expiredContext);

      expect(upload.abandonIfUnusable(context)).toBeNull();
      expect(ended?.event).toEqual({ userId, uploadId });
      expect(ended?.upload.abandonIfUnusable(expiredContext)).toBeNull();
      expect(() => ended?.upload.readStatus(context)).toThrow(expect.objectContaining({ reason }));
    },
  );

  it('refuses impossible stored states and keeps saved timestamps immutable', () => {
    const snapshot = reserve().snapshot;
    const stored = { ...snapshot, storageMetadata: 'ignored' };
    const restored = AvatarUpload.restore(stored);
    snapshot.expiresAt.setTime(1);
    restored.snapshot.expiresAt.setTime(2);

    expect(restored.snapshot.expiresAt).toEqual(expiresAt);
    expect(restored.snapshot).not.toHaveProperty('storageMetadata');
    expect(() => AvatarUpload.restore({ ...snapshot, id: 'not-an-id' })).toThrow(AvatarRefusal);
    expect(() => AvatarUpload.restore({ ...snapshot, generation: -1 })).toThrow(AvatarRefusal);
    expect(() => AvatarUpload.restore({ ...snapshot, expiresAt: new Date(NaN) })).toThrow(
      AvatarRefusal,
    );
  });
});
