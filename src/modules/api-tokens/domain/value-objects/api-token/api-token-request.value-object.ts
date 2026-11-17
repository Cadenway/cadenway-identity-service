import type { ApiTokenExpiration } from './api-token-expiration.value-object.js';

/**
 * Interface ApiTokenRequest
 *
 * @description
 * What a session asks for when it creates a token, with the prefix of the secret drawn for it.
 */
export interface ApiTokenRequest {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The current organization of the session, from its verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property userId
   *
   * @description
   * The user of the session, from its verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

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
   * Scopes as given, a scope given twice included.
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
   * @type {ApiTokenExpiration}
   * @readonly
   */
  readonly expiration: ApiTokenExpiration;

  /**
   * Property prefix
   *
   * @description
   * First 11 characters of the secret drawn for the token.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;
  // #endregion
}
