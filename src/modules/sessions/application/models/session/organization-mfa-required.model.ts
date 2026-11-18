/**
 * Class OrganizationMfaRequired
 *
 * @description
 * Thrown by the choice of an organization whose authentication policy requires two-step
 * verification for the role of the actor, who has none (`403 organization.mfa-required`): the
 * session and the last choice stay as they were.
 */
export class OrganizationMfaRequired extends Error {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The organization withheld, for `details.organizationId`.
   *
   * @type {string}
   * @readonly
   */
  public readonly organizationId: string;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the organization.
   *
   * @param {string} organizationId - The organization.
   * @constructor
   */
  public constructor(organizationId: string) {
    super('The organization requires two-step verification of the actor.');
    this.name = 'OrganizationMfaRequired';
    this.organizationId = organizationId;
  }
  // #endregion
}
