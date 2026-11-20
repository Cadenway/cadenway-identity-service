/** The current active membership held by the caller's transaction. */
export interface LockActiveMembershipOutput {
  // #region Properties
  /** Identifier of the active membership. */
  readonly memberId: string;

  /** Organization of the active membership. */
  readonly organizationId: string;

  /** Account of the active membership. */
  readonly userId: string;

  /** Role held by the account. */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  // #endregion
}
