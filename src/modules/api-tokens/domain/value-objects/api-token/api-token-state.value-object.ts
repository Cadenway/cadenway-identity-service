/**
 * Interface ApiTokenState
 *
 * @description
 * A stored personal API token. Its secret is never part of it: the repository keeps its SHA-256
 * hash apart, and `prefix`, its first 11 characters, only to recognize it in a list.
 */
export interface ApiTokenState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id assigned by PostgreSQL.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property organizationId
   *
   * @description
   * Organization the token acts in: the current organization of the session that created it.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property userId
   *
   * @description
   * Account the token acts for.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Name, trimmed ("Nom").
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property prefix
   *
   * @description
   * First 11 characters of the secret, `cw_pat_` and 4 random characters.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;

  /**
   * Property scopes
   *
   * @description
   * Scopes of the token, each once, in the order they were given.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly scopes: readonly string[];

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
   * When the token stops working, or `null` for a token without expiry.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly expiresAt: Date | null;

  /**
   * Property lastUsedAt
   *
   * @description
   * Last recorded use, within a minute, or `null` before the first.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lastUsedAt: Date | null;

  /**
   * Property revokedAt
   *
   * @description
   * When the token was revoked, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly revokedAt: Date | null;

  /**
   * Property version
   *
   * @description
   * Version of the token: 1 when created, 2 once revoked. A use is not a change of version.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
