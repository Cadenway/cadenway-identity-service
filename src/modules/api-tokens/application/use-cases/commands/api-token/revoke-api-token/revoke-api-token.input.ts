/**
 * Interface RevokeApiTokenInput
 *
 * @description
 * Who revokes which token, in which organization.
 */
export interface RevokeApiTokenInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The user of the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property organizationId
   *
   * @description
   * The organization of the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property apiTokenId
   *
   * @description
   * The token.
   *
   * @type {string}
   * @readonly
   */
  readonly apiTokenId: string;
  // #endregion
}
