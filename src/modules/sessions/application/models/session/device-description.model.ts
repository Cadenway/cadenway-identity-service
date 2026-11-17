/**
 * Interface DeviceDescription
 *
 * @description
 * What a `User-Agent` tells about the device of a session, in the shape of `Device` of the
 * contracts: shown on the "Sessions actives" of the account ("Firefox 132 · Windows 11"), in the
 * "Nouvelle connexion" e-mail, and compared to tell a new device. A `User-Agent` cannot tell
 * Windows 11 from Windows 10 (`cw-identity-security`): the version of Windows and macOS is `null`.
 */
export interface DeviceDescription {
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
   * Name of the browser, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly browser: string | null;

  /**
   * Property browserVersion
   *
   * @description
   * Major version of the browser, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly browserVersion: string | null;

  /**
   * Property os
   *
   * @description
   * Name of the operating system, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly os: string | null;

  /**
   * Property osVersion
   *
   * @description
   * Version of the operating system, or `null` when the `User-Agent` does not tell it reliably.
   *
   * @type {string | null}
   * @readonly
   */
  readonly osVersion: string | null;
  // #endregion
}
