import type { AvatarOwner } from '../../../../models/avatar/avatar-owner.model.js';

/** The verified account owner and optional strong account version. */
export interface RemoveAvatarInput extends AvatarOwner {
  // #region Properties
  /** expectedVersion of the account avatar operation. */
  readonly expectedVersion?: number;
  // #endregion
}
