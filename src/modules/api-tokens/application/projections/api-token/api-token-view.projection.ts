/**
 * Interface ApiTokenView
 *
 * @description
 * A token as the use cases return it (`ApiToken` of the contract), never with its secret.
 */
export interface ApiTokenView {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the token.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property prefix
   *
   * @description
   * First 11 characters of the secret.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;

  /**
   * Property scopes
   *
   * @description
   * Scopes of the token.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly scopes: readonly string[];

  /**
   * Property organizationId
   *
   * @description
   * Organization the token acts in.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property createdAt
   *
   * @description
   * When the token was created.
   *
   * @type {Date}
   * @readonly
   */
  readonly createdAt: Date;

  /**
   * Property expiresAt
   *
   * @description
   * When it stops working, or `null` without expiry.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly expiresAt: Date | null;

  /**
   * Property lastUsedAt
   *
   * @description
   * Last recorded use, or `null` before the first.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lastUsedAt: Date | null;
  // #endregion
}
