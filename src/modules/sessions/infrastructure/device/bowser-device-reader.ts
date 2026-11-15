import Bowser from 'bowser';

import type {
  DeviceDescription,
  DeviceReader,
} from '../../application/ports/device-reader.port.js';

/**
 * Constant UNKNOWN_DEVICE
 *
 * @description
 * The description of a session whose browser sent no `User-Agent`, or one `bowser` cannot read.
 *
 * @type {DeviceDescription}
 */
const UNKNOWN_DEVICE: DeviceDescription = {
  browser: null,
  operatingSystem: null,
  deviceType: null,
};

/**
 * Function label
 *
 * @description
 * Joins a name and a version, or returns `null` without a name.
 *
 * @param {string | undefined} name - The name.
 * @param {string | undefined} version - The version, optional.
 * @returns {string | null} `<name> <version>`, `<name>`, or `null`.
 */
function label(name: string | undefined, version: string | undefined): string | null {
  if (name === undefined || name.length === 0) {
    return null;
  }
  return version === undefined || version.length === 0 ? name : `${name} ${version}`;
}

/**
 * Class BowserDeviceReader
 *
 * @description
 * `DeviceReader` with `bowser`, the parser every Cadenway backend uses for a `User-Agent`
 * (`cw-identity-security`). It keeps the major version of the browser and the version name of the
 * system (`Firefox 145`, `Windows 10`).
 */
export class BowserDeviceReader implements DeviceReader {
  // #region Methods
  /**
   * Method read
   *
   * @description
   * Describes the device of a `User-Agent`.
   *
   * @param {string | null} userAgent - The header, or `null`.
   * @returns {DeviceDescription} What it tells.
   */
  public read(userAgent: string | null): DeviceDescription {
    if (userAgent === null || userAgent.trim().length === 0) {
      return UNKNOWN_DEVICE;
    }
    try {
      const parsed: Bowser.Parser.ParsedResult = Bowser.parse(userAgent);
      return {
        browser: label(parsed.browser.name, parsed.browser.version?.split('.')[0]),
        operatingSystem: label(parsed.os.name, parsed.os.versionName ?? parsed.os.version),
        deviceType: parsed.platform.type ?? null,
      };
    } catch {
      return UNKNOWN_DEVICE;
    }
  }
  // #endregion
}
