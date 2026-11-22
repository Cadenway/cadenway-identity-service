/** The current membership Organization proved for the verified actor and tenant. */
export interface FindAuthoritativeMembershipOutput {
  // #region Properties
  /** The generation of the current membership. */
  readonly memberId: string;

  /** The verified organization. */
  readonly organizationId: string;

  /** The verified account. */
  readonly userId: string;

  /** The current role. */
  readonly role: 'owner' | 'admin' | 'member' | 'guest';
  // #endregion
}
