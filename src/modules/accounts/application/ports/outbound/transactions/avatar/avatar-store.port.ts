import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { AvatarUpload } from '../../../../../domain/aggregates/avatar-upload/avatar-upload.aggregate.js';
import type { AvatarChanged } from '../../../../../domain/events/avatar/avatar-changed.event.js';
import type { AvatarUploadAbandoned } from '../../../../../domain/events/avatar/avatar-upload-abandoned.event.js';

/** Account-owned avatar operations bound to one system transaction. */
export interface AvatarStore {
  // #region Methods
  /** Locks the owner before any reservation for that account. */
  lockUser(userId: string): Promise<User | null>;

  /** Reads the explicitly identified account. */
  findUser(userId: string): Promise<User | null>;

  /** Finds a reservation by its account and upload identity. */
  findUpload(userId: string, uploadId: string): Promise<AvatarUpload | null>;

  /** Locks an account's reservation after locking the account. */
  lockUpload(userId: string, uploadId: string): Promise<AvatarUpload | null>;

  /** Resolves the original reservation for an account-scoped idempotency key. */
  findByIdempotencyKey(userId: string, key: string): Promise<AvatarUpload | null>;

  /** Allocates an opaque version-seven upload identity. */
  newUploadId(): Promise<string>;

  /** Inserts the reservation and optional account-scoped idempotency binding atomically. */
  insertUpload(upload: AvatarUpload, idempotencyKey?: string): Promise<void>;

  /** Saves a locked reservation transition. */
  saveUpload(upload: AvatarUpload): Promise<void>;

  /** Updates the locked account with a check on its previous version and avatar generation. */
  saveAvatar(previous: User, next: User): Promise<void>;

  /** Appends an actual avatar change in this transaction. */
  appendChanged(event: AvatarChanged): Promise<void>;

  /** Appends an abandoned upload in this transaction. */
  appendAbandoned(event: AvatarUploadAbandoned): Promise<void>;
  // #endregion
}
