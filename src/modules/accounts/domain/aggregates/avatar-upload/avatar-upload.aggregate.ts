import { AvatarRefusal } from '../../errors/avatar/avatar-refusal.error.js';
import type { AvatarUploadAbandoned } from '../../events/avatar/avatar-upload-abandoned.event.js';
import { isAvatarUploadId } from '../../policies/avatar/avatar-upload-id.policy.js';
import type { AvatarUploadContext } from '../../value-objects/avatar/avatar-upload-context.value-object.js';
import type { AvatarUploadSnapshot } from '../../value-objects/avatar/avatar-upload-snapshot.value-object.js';

const ownerId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const acceptedContentTypes: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const maximumSourceBytes = 5_242_880;
const reservationMs = 5 * 60_000;

/** Account avatar reservation from the profile media contract and Identity avatar operations. */
export class AvatarUpload {
  // #region Properties
  /** Immutable snapshot of the reservation for persistence. */
  public get snapshot(): AvatarUploadSnapshot {
    return { ...this.state, expiresAt: new Date(this.state.expiresAt) };
  }
  // #endregion

  // #region Constructor
  /** Keeps a validated reservation; no operation can change its identity, declaration or expiry. */
  private constructor(private readonly state: AvatarUploadSnapshot) {}
  // #endregion

  // #region Methods
  /** Binds a declaration to the current generation and the original five-minute upload lease. */
  public static reserve(
    input: Readonly<Pick<AvatarUploadSnapshot, 'id' | 'contentType' | 'sizeBytes'>> &
      AvatarUploadContext,
  ): AvatarUpload {
    const { id, userId, generation, contentType, sizeBytes, now } = input;
    if (!acceptedContentTypes.has(contentType)) throw new AvatarRefusal('unsupported-type');
    if (sizeBytes > maximumSourceBytes) throw new AvatarRefusal('file-too-large');
    return AvatarUpload.restore({
      id,
      userId,
      generation,
      contentType,
      sizeBytes,
      // The signed S3 POST policy represents its deadline in whole seconds.
      expiresAt: new Date(Math.floor((now.getTime() + reservationMs) / 1_000) * 1_000),
      status: 'pending',
    });
  }

  /** Restores the owner receipt, refusing invalid stored declarations, expiry or status. */
  public static restore(state: AvatarUploadSnapshot): AvatarUpload {
    if (
      !isAvatarUploadId(state.id) ||
      !ownerId.test(state.userId) ||
      !Number.isSafeInteger(state.generation) ||
      state.generation < 0 ||
      !acceptedContentTypes.has(state.contentType) ||
      !Number.isInteger(state.sizeBytes) ||
      state.sizeBytes < 1 ||
      state.sizeBytes > maximumSourceBytes ||
      !Number.isFinite(state.expiresAt.getTime()) ||
      !['pending', 'committed', 'expired', 'superseded'].includes(state.status)
    ) {
      throw new AvatarRefusal('invalid-state');
    }
    return new AvatarUpload({
      id: state.id.toLowerCase(),
      userId: state.userId.toLowerCase(),
      generation: state.generation,
      contentType: state.contentType,
      sizeBytes: state.sizeBytes,
      expiresAt: new Date(state.expiresAt),
      status: state.status,
    });
  }

  /** Accepts the owner's identical idempotency replay without changing the original lease. */
  public assertEquivalent(
    userId: string,
    declaration: Readonly<Pick<AvatarUploadSnapshot, 'contentType' | 'sizeBytes'>>,
  ): void {
    this.assertOwner(userId);
    if (
      declaration.contentType !== this.state.contentType ||
      declaration.sizeBytes !== this.state.sizeBytes
    ) {
      throw new AvatarRefusal('key-reused');
    }
  }

  /** Permits preparation only while pending and live. A committed match remains a replay receipt. */
  public readStatus(context: AvatarUploadContext): 'pending' | 'committed' {
    this.assertOwner(context.userId);
    if (this.state.status === 'committed') return 'committed';
    if (this.state.status !== 'pending') throw new AvatarRefusal(this.state.status);
    const reason = this.unusableReason(context);
    if (reason !== null) throw new AvatarRefusal(reason);
    return 'pending';
  }

  /** Records successful adoption and preserves a previously committed receipt. */
  public commit(context: AvatarUploadContext): AvatarUpload {
    if (this.readStatus(context) === 'committed') return this;
    return new AvatarUpload({ ...this.state, status: 'committed' });
  }

  /** Returns the terminal decision and cleanup fact for a locked, expired or superseded upload. */
  public abandonIfUnusable(
    context: AvatarUploadContext,
  ): { readonly upload: AvatarUpload; readonly event: AvatarUploadAbandoned } | null {
    this.assertOwner(context.userId);
    if (this.state.status !== 'pending') return null;
    const reason = this.unusableReason(context);
    if (reason === null) return null;
    return {
      upload: new AvatarUpload({ ...this.state, status: reason }),
      event: { userId: this.state.userId, uploadId: this.state.id },
    };
  }

  private assertOwner(userId: string): void {
    if (userId.toLowerCase() !== this.state.userId) throw new AvatarRefusal('not-found');
  }

  private unusableReason(context: AvatarUploadContext): 'expired' | 'superseded' | null {
    const now = context.now.getTime();
    if (
      !Number.isFinite(now) ||
      !Number.isSafeInteger(context.generation) ||
      context.generation < 0
    ) {
      throw new AvatarRefusal('invalid-state');
    }
    if (context.generation !== this.state.generation) return 'superseded';
    return now >= this.state.expiresAt.getTime() ? 'expired' : null;
  }
  // #endregion
}
