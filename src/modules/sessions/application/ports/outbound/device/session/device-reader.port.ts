import type { DeviceDescription } from '../../../../models/session/device-description.model.js';

/**
 * Interface DeviceReader
 *
 * @description
 * Reads a `User-Agent` header.
 */
export interface DeviceReader {
  // #region Methods
  /**
   * Method read
   *
   * @description
   * Describes the device of a `User-Agent`; never throws, whatever the header holds.
   *
   * @param {string | null} userAgent - The header, or `null` when the browser sent none.
   * @returns {DeviceDescription} What the header tells, `null` members for the rest.
   */
  read(userAgent: string | null): DeviceDescription;
  // #endregion
}
