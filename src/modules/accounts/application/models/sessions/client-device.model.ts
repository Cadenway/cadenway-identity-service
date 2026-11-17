/**
 * Interface ClientDevice
 *
 * @description
 * The device of a browser as the security e-mails show it ("Firefox sur Windows"), read from its
 * `User-Agent` (`Device` of `asyncapi/identity-service.yaml`). A member that cannot be read is
 * `null`.
 */
export interface ClientDevice {
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
   * Name of the browser or client, or `null`.
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
   * Version of the operating system, `null` when the `User-Agent` does not tell it reliably.
   *
   * @type {string | null}
   * @readonly
   */
  readonly osVersion: string | null;
  // #endregion
}
