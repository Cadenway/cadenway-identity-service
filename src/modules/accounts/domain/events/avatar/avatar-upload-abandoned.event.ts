/** A terminal reservation decision, from `user.avatar-upload-abandoned.v1` in Identity AsyncAPI. */
export interface AvatarUploadAbandoned {
  // #region Properties
  /** Account and upload identities that Storage uses to retire the unused object. */
  readonly userId: string;
  readonly uploadId: string;
  // #endregion
}
