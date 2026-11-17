import type { ClientDevice } from './client-device.model.js';

/**
 * Interface ClientDescription
 *
 * @description
 * The browser a request came from as a security e-mail shows it: the rows "Appareil" and "Adresse
 * IP" (`Client` of `asyncapi/identity-service.yaml`). No place is derived from the address.
 */
export interface ClientDescription {
  // #region Properties
  /**
   * Property device
   *
   * @description
   * The device read from the `User-Agent`.
   *
   * @type {ClientDevice}
   * @readonly
   */
  readonly device: ClientDevice;

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
  // #endregion
}
