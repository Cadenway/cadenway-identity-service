/**
 * Interface SecurityKeyView
 *
 * @description
 * A security key of the card of the account (`SecurityKey` of the contract), without its
 * credential.
 */
export interface SecurityKeyView {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the key.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Its name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property createdAt
   *
   * @description
   * When it was registered.
   *
   * @type {Date}
   * @readonly
   */
  readonly createdAt: Date;

  /**
   * Property lastUsedAt
   *
   * @description
   * When it last answered a challenge.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lastUsedAt: Date | null;
  // #endregion
}
