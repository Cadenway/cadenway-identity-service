import type { DeviceIdentity } from '../../value-objects/session/device-identity.value-object.js';

/**
 * Constant NEW_DEVICE_LOOKBACK_MS
 *
 * @description
 * How far back the devices of an account count as known: 90 days ("a device that no session of the
 * account used in the 90 days before", `session.opened-on-new-device.v1`).
 *
 * @type {number}
 */
export const NEW_DEVICE_LOOKBACK_MS: number = 90 * 24 * 60 * 60_000;

/**
 * Constant NEW_DEVICE_COMPARED_USER_AGENTS
 *
 * @description
 * How many browsers of the account a sign-in compares its device with at most: the 100 `User-Agent`
 * used last in the 90 days. The `User-Agent` comes from the browser, so without a bound an account
 * that signs in with ever new ones would make each of its sign-ins read and parse more of them while
 * it holds a connection; a device left out by this bound is told as new.
 *
 * @type {number}
 */
export const NEW_DEVICE_COMPARED_USER_AGENTS: number = 100;

/**
 * Function isNewDevice
 *
 * @description
 * Whether a sign-in comes from a device none of the known devices of the account matches: two
 * devices are the same when their type, browser and operating system are, whatever their versions
 * and addresses (`session.opened-on-new-device.v1` of `asyncapi/identity-service.yaml`; the
 * mockup's "Votre compte vient d’être utilisé sur un appareil que nous ne connaissions pas.").
 *
 * @param {DeviceIdentity} device - The device of the sign-in.
 * @param {readonly DeviceIdentity[]} known - The devices of the sessions the account used in the
 * last 90 days.
 * @returns {boolean} `true` when none matches.
 */
export function isNewDevice(device: DeviceIdentity, known: readonly DeviceIdentity[]): boolean {
  return !known.some(
    (other: DeviceIdentity) =>
      other.type === device.type && other.browser === device.browser && other.os === device.os,
  );
}
