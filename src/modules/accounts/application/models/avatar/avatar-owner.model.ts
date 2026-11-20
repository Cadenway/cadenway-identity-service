/** The verified user and account named by an avatar operation. */
export interface AvatarOwner {
  // #region Properties
  /** actorUserId of the account avatar operation. */
  readonly actorUserId: string;

  /** userId of the account avatar operation. */
  readonly userId: string;
  // #endregion
}
