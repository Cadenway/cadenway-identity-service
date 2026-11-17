import type { ClientDescription } from '../../models/sessions/client-description.model.js';
import type { SessionClient } from '../../models/sessions/session-client.model.js';
import type { DeviceReader } from '../../ports/outbound/device/accounts/device-reader.port.js';

/**
 * Function toClientDescription
 *
 * @description
 * The browser of a request as a security e-mail shows it: its device read from the `User-Agent`
 * and its address. The `User-Agent` itself does not travel in events.
 *
 * @param {DeviceReader} devices - Reads the `User-Agent`.
 * @param {SessionClient} client - The browser, as the gateway saw it.
 * @returns {ClientDescription} The device and the address.
 */
export function toClientDescription(
  devices: DeviceReader,
  client: SessionClient,
): ClientDescription {
  return { device: devices.read(client.userAgent), ipAddress: client.ipAddress };
}
