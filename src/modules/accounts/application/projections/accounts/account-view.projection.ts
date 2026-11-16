/**
 * Interface AccountView
 *
 * @description
 * An account as the use cases return it (`User` of the contract).
 */
export interface AccountView {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Full name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Normalized address.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property language
   *
   * @description
   * BCP 47 tag of the language of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly language: string;

  /**
   * Property version
   *
   * @description
   * Version of the account, its `ETag`.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
