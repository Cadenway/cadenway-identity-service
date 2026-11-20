import type { AvatarUploadStatus } from './avatar-upload-status.value-object.js';

/** Owner state of an avatar reservation, without any Storage path or upload capability. */
export interface AvatarUploadSnapshot {
  // #region Properties
  /** Opaque UUIDv7 allocated by Identity and reused by Storage as the prepared asset id. */
  readonly id: string;

  /** Account that can reserve and publish this avatar. */
  readonly userId: string;

  /** Avatar generation at the time of reservation. */
  readonly generation: number;

  /** Image declaration bound to this reservation and its idempotent response. */
  readonly contentType: string;
  readonly sizeBytes: number;

  /** Original exclusive expiry. A retry preserves this instant. */
  readonly expiresAt: Date;

  /** State governing first publication and committed replay. */
  readonly status: AvatarUploadStatus;
  // #endregion
}
