import type { AvatarOwner } from '../../../../models/avatar/avatar-owner.model.js';

/** Validated request after the gateway prepared this owner's pending upload. */
export interface PublishAvatarInput extends AvatarOwner {
  // #region Properties
  /** uploadId of the account avatar operation. */
  readonly uploadId: string;

  /** expectedVersion of the account avatar operation. */
  readonly expectedVersion?: number;
  // #endregion
}
