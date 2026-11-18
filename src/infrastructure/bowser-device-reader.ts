import Bowser from 'bowser';

/**
 * Constant DEVICE_TYPES
 *
 * @description
 * The device types of the contract (`Device` of `asyncapi/identity-service.yaml` and of
 * `openapi/internal/identity-service.yaml`); any other kind `bowser` reports (a television, a bot)
 * is `unknown`.
 *
 * @type {ReadonlySet<string>}
 */
const DEVICE_TYPES: ReadonlySet<string> = new Set(['desktop', 'mobile', 'tablet']);

/**
 * Constant FROZEN_SYSTEMS
 *
 * @description
 * Operating systems whose `User-Agent` does not tell the version reliably: Windows 10 and 11 look
 * alike, the version of macOS is frozen ("`null` when the `User-Agent` does not tell it
 * reliably").
 *
 * @type {ReadonlySet<string>}
 */
const FROZEN_SYSTEMS: ReadonlySet<string> = new Set(['Windows', 'macOS']);

/**
 * Constant NAME_MAX_LENGTH
 *
 * @description
 * Longest browser or system name an event accepts (`maxLength: 60`).
 *
 * @type {number}
 */
const NAME_MAX_LENGTH: number = 60;

/**
 * Constant VERSION_MAX_LENGTH
 *
 * @description
 * Longest version an event accepts (`maxLength: 20`).
 *
 * @type {number}
 */
const VERSION_MAX_LENGTH: number = 20;

/**
 * Interface ReadDevice
 *
 * @description
 * The device of a browser, in the shape of the contract.
 */
interface ReadDevice {
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
   * Version of the operating system, or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly osVersion: string | null;
  // #endregion
}

/**
 * Constant UNKNOWN_DEVICE
 *
 * @description
 * The device of a browser that sent no `User-Agent`, or one that cannot be read.
 *
 * @type {ReadDevice}
 */
const UNKNOWN_DEVICE: ReadDevice = {
  type: 'unknown',
  browser: null,
  browserVersion: null,
  os: null,
  osVersion: null,
};

/**
 * Function bounded
 *
 * @description
 * A value read from the header, `null` when empty, cut to the length the contract accepts.
 *
 * @param {string | undefined} value - The value `bowser` read.
 * @param {number} maxLength - Its longest length.
 * @returns {string | null} The value, or `null`.
 */
function bounded(value: string | undefined, maxLength: number): string | null {
  const trimmed: string = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
}

/**
 * Class BowserDeviceReader
 *
 * @description
 * Reads the device of a browser from its `User-Agent` with `bowser` (`cw-identity-security`, "Device
 * of a session"), in the shape of the contract: type, browser and major version, system and its
 * version. Bound by the sessions module, for the list of the sessions and the detection of a new
 * device, and by the accounts module, for the rows "Appareil" of the security e-mails, each to its
 * own port. The `User-Agent` itself is never logged.
 */
export class BowserDeviceReader {
  // #region Methods
  /**
   * Method read
   *
   * @description
   * Reads a `User-Agent`; what cannot be read is `null`, and an empty or unreadable one is an
   * unknown device.
   *
   * @param {string | null} userAgent - The header, or `null` when the browser sent none.
   * @returns {ReadDevice} The device.
   */
  public read(userAgent: string | null): ReadDevice {
    if (userAgent === null || userAgent.trim().length === 0) {
      return UNKNOWN_DEVICE;
    }
    try {
      const parsed: Bowser.Parser.ParsedResult = Bowser.parse(userAgent);
      const os: string | null = bounded(parsed.os.name, NAME_MAX_LENGTH);
      return {
        type: DEVICE_TYPES.has(parsed.platform.type ?? '')
          ? (parsed.platform.type ?? '')
          : 'unknown',
        browser: bounded(parsed.browser.name, NAME_MAX_LENGTH),
        browserVersion: bounded(parsed.browser.version?.split('.')[0], VERSION_MAX_LENGTH),
        os,
        osVersion:
          os === null || FROZEN_SYSTEMS.has(os)
            ? null
            : bounded(parsed.os.version, VERSION_MAX_LENGTH),
      };
    } catch {
      return UNKNOWN_DEVICE;
    }
  }
  // #endregion
}
