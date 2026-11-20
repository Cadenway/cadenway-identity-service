import type { AvatarOwner } from '../../../../models/avatar/avatar-owner.model.js';

/** Verified owner and the opaque upload identity. */
export interface GetAvatarUploadInput extends AvatarOwner {
  // #region Properties
  /** uploadId of the account avatar operation. */
  readonly uploadId: string;
  // #endregion
}
