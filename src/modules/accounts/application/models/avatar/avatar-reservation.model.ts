/** The reservation exposed to the trusted gateway. */
export interface AvatarReservation {
  // #region Properties
  /** uploadId of the account avatar operation. */
  readonly uploadId: string;

  /** expiresAt of the account avatar operation. */
  readonly expiresAt: Date;
  // #endregion
}
