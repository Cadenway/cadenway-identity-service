/** The organization and account from the verified session. */
export interface LockActiveMembershipInput {
  // #region Properties
  /** Organization from the verified session. */
  readonly organizationId: string;

  /** Account from the verified session. */
  readonly userId: string;
  // #endregion
}
