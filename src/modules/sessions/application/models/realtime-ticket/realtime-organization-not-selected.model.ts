/** The verified session no longer acts in the organization of the request. */
export class RealtimeOrganizationNotSelected extends Error {
  // #region Constructor
  /** Builds the refusal without identifying a different organization. */
  public constructor() {
    super('The session does not act in the requested organization.');
    this.name = 'RealtimeOrganizationNotSelected';
  }
  // #endregion
}
