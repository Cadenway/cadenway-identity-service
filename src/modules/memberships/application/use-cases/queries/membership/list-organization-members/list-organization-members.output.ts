/**
 * Interface ListOrganizationMembersOutput
 *
 * @description
 * The active members of an organization in the copy, one per account.
 */
export interface ListOrganizationMembersOutput {
  // #region Properties
  /**
   * Property members
   *
   * @description
   * The account and the role of each, ordered by account id.
   *
   * @type {readonly { readonly userId: string; readonly role: 'owner' | 'admin' | 'member' | 'guest' }[]}
   * @readonly
   */
  readonly members: readonly {
    readonly userId: string;
    readonly role: 'owner' | 'admin' | 'member' | 'guest';
  }[];
  // #endregion
}
