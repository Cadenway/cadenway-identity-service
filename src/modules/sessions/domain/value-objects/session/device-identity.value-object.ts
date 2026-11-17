/**
 * Interface DeviceIdentity
 *
 * @description
 * What makes two devices the same for "Nouvelle connexion" (`session.opened-on-new-device.v1`):
 * their type, browser and operating system, whatever their versions and addresses.
 */
export interface DeviceIdentity {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * `desktop`, `mobile`, `tablet` or `unknown`.
   *
   * @type {string}
   * @readonly
   */
  readonly type: string;

  /**
   * Property browser
   *
   * @description
   * Name of the browser, or `null` when it cannot be read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly browser: string | null;

  /**
   * Property os
   *
   * @description
   * Name of the operating system, or `null` when it cannot be read.
   *
   * @type {string | null}
   * @readonly
   */
  readonly os: string | null;
  // #endregion
}
