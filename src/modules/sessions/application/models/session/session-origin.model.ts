import type { DeviceDescription } from './device-description.model.js';

/**
 * Interface SessionOrigin
 *
 * @description
 * Where a session was opened: stored with it to show its device and place later, never logged with
 * its token.
 */
export interface SessionOrigin {
  // #region Properties
  /**
   * Property tokenHash
   *
   * @description
   * SHA-256 of the token.
   *
   * @type {string}
   * @readonly
   */
  readonly tokenHash: string;

  /**
   * Property ipAddress
   *
   * @description
   * Address of the browser, as the gateway saw it.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property userAgent
   *
   * @description
   * `User-Agent` of the browser, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly userAgent: string | null;

  /**
   * Property device
   *
   * @description
   * What the `User-Agent` tells about the device.
   *
   * @type {DeviceDescription}
   * @readonly
   */
  readonly device: DeviceDescription;
  // #endregion
}
