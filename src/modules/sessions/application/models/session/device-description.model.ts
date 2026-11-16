/**
 * Interface DeviceDescription
 *
 * @description
 * What a `User-Agent` tells about the device of a session, to show it later on the Sécurité screen
 * of the account. A `User-Agent` cannot tell Windows 11 from Windows 10 (`cw-identity-security`).
 */
export interface DeviceDescription {
  // #region Properties
  /**
   * Property browser
   *
   * @description
   * Browser name and major version (`Firefox 145`), or `null` when unknown.
   *
   * @type {string | null}
   * @readonly
   */
  readonly browser: string | null;

  /**
   * Property operatingSystem
   *
   * @description
   * Operating system and its version name when known (`Windows 10`), or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly operatingSystem: string | null;

  /**
   * Property deviceType
   *
   * @description
   * Kind of device (`desktop`, `mobile`, `tablet`, `tv`), or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly deviceType: string | null;
  // #endregion
}
