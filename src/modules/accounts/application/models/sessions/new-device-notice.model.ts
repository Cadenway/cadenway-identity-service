/**
 * Interface NewDeviceNotice
 *
 * @description
 * Whom the "Nouvelle connexion" e-mail addresses when a sign-in opens a session on a device the
 * account did not use in the last 90 days (`session.opened-on-new-device.v1`).
 */
export interface NewDeviceNotice {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Address of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property name
   *
   * @description
   * Full name of the account, for the greeting.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property language
   *
   * @description
   * Language of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly language: string;

  /**
   * Property timeZone
   *
   * @description
   * Time zone of the account, in which the e-mail shows the date.
   *
   * @type {string}
   * @readonly
   */
  readonly timeZone: string;
  // #endregion
}
