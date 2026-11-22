/** The actor and tenant from a verified local credential. */
export interface FindAuthoritativeMembershipInput {
  // #region Properties
  /** The organization to which the credential applies. */
  readonly organizationId: string;

  /** The account named by the credential. */
  readonly userId: string;
  // #endregion
}
