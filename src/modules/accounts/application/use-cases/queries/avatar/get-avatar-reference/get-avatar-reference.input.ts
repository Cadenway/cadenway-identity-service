/** Actor, target and organization already established by the trusted gateway. */
export interface GetAvatarReferenceInput {
  // #region Properties
  /** actorUserId of the account avatar operation. */
  readonly actorUserId: string;

  /** userId of the account avatar operation. */
  readonly userId: string;

  /** organizationId of the account avatar operation. */
  readonly organizationId: string | null;
  // #endregion
}
