/**
 * Class OrganizationNotFound
 *
 * @description
 * Thrown when the copy of the memberships holds no active membership of the actor in the chosen
 * organization (`organization.not-found`): not a member, removed, or a membership that has not
 * reached this service yet.
 */
export class OrganizationNotFound extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Builds the refusal, without the ids.
   *
   * @constructor
   */
  public constructor() {
    super('The actor is not a member of this organization.');
    this.name = 'OrganizationNotFound';
  }
  // #endregion
}
