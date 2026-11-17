import type { ClientDevice } from '../../../../models/sessions/client-device.model.js';

/**
 * Interface DeviceReader
 *
 * @description
 * Reads the device of a browser from its `User-Agent`, for the rows of the security e-mails.
 */
export interface DeviceReader {
  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads a `User-Agent`; what cannot be read is `null`, and an empty one is an unknown device.
   *
   * @param {string | null} userAgent - The header, or `null` when the browser sent none.
   * @returns {ClientDevice} The device.
   */
  read(userAgent: string | null): ClientDevice;
  // #endregion
}
