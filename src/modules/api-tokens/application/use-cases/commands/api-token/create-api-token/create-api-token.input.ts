/**
 * Interface CreateApiTokenInput
 *
 * @description
 * A token a session creates (`ApiTokenCreation` of the contract), for the user and the organization
 * of its verified internal token.
 */
export interface CreateApiTokenInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The user of the verified internal token, never a value of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property organizationId
   *
   * @description
   * The organization of the verified internal token, the current one of the session.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property name
   *
   * @description
   * Name as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property scopes
   *
   * @description
   * Scopes as given.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly scopes: readonly string[];

  /**
   * Property expiration
   *
   * @description
   * Lifetime of the token.
   *
   * @type {'30-days' | '90-days' | '1-year' | 'never'}
   * @readonly
   */
  readonly expiration: '30-days' | '90-days' | '1-year' | 'never';
  // #endregion
}
