/**
 * Interface FindUserMembershipsOutput
 *
 * @description
 * The active memberships of an account in the copy, one per organization.
 */
export interface FindUserMembershipsOutput {
  // #region Properties
  /**
   * Property memberships
   *
   * @description
   * The organization and the role of each, ordered by organization id.
   *
   * @type {readonly { readonly organizationId: string; readonly role: 'owner' | 'admin' | 'member' | 'guest' }[]}
   * @readonly
   */
  readonly memberships: readonly {
    readonly organizationId: string;
    readonly role: 'owner' | 'admin' | 'member' | 'guest';
  }[];
  // #endregion
}
