import type { AvatarOwner } from '../../../../models/avatar/avatar-owner.model.js';

/** Verified owner and validated source declaration for one reservation. */
export interface ReserveAvatarUploadInput extends AvatarOwner {
  // #region Properties
  /** contentType of the account avatar operation. */
  readonly contentType: string;

  /** sizeBytes of the account avatar operation. */
  readonly sizeBytes: number;

  /** idempotencyKey of the account avatar operation. */
  readonly idempotencyKey?: string;
  // #endregion
}
