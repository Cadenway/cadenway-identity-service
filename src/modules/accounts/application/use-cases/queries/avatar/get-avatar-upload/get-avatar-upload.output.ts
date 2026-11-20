import type { AvatarReservation } from '../../../../models/avatar/avatar-reservation.model.js';

/** Current state and original expiry of an owner reservation. */
export interface GetAvatarUploadOutput extends AvatarReservation {
  // #region Properties
  /** state of the account avatar operation. */
  readonly state: 'pending' | 'committed';
  // #endregion
}
