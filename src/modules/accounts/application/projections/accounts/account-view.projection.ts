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
   * Property displayName
   *
   * @description
   * "Nom affiché", or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly displayName: string | null;

  /**
   * Property jobTitle
   *
   * @description
   * "Poste (facultatif)", or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly jobTitle: string | null;

  /**
   * Property timeZone
   *
   * @description
   * IANA time zone name.
   *
   * @type {string}
   * @readonly
   */
  readonly timeZone: string;

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

  /**
   * Property passwordChangedAt
   *
   * @description
   * When the password was last set ("Modifié le 12 août 2026.").
   *
   * @type {Date}
   * @readonly
   */
  readonly passwordChangedAt: Date;
  // #endregion
}
