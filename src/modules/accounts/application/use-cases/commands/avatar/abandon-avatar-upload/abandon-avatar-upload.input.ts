/** Reservation selected by the bounded account upload cleanup. */
export interface AbandonAvatarUploadInput {
  // #region Properties
  /** userId of the account avatar operation. */
  readonly userId: string;

  /** uploadId of the account avatar operation. */
  readonly uploadId: string;
  // #endregion
}
