import { describe, expect, it } from 'vitest';

import type { DeviceIdentity } from '../../value-objects/session/device-identity.value-object.js';
import { isNewDevice, NEW_DEVICE_LOOKBACK_MS } from './new-device.policy.js';

/**
 * Constant FIREFOX_ON_WINDOWS
 *
 * @description
 * The computer of Camille Martin ("Firefox 132 · Windows 11" of the mockup).
 *
 * @type {DeviceIdentity}
 */
const FIREFOX_ON_WINDOWS: DeviceIdentity = { type: 'desktop', browser: 'Firefox', os: 'Windows' };

describe('isNewDevice', () => {
  it('knows a device of the same type, browser and system, whatever its versions', () => {
    expect(isNewDevice(FIREFOX_ON_WINDOWS, [{ ...FIREFOX_ON_WINDOWS }])).toBe(false);
  });

  it('tells a new device by its system, its browser or its type', () => {
    expect(isNewDevice({ ...FIREFOX_ON_WINDOWS, os: 'macOS' }, [FIREFOX_ON_WINDOWS])).toBe(true);
    expect(isNewDevice({ ...FIREFOX_ON_WINDOWS, browser: 'Chrome' }, [FIREFOX_ON_WINDOWS])).toBe(
      true,
    );
    expect(
      isNewDevice({ type: 'mobile', browser: 'Safari', os: 'iOS' }, [FIREFOX_ON_WINDOWS]),
    ).toBe(true);
  });

  it('tells every device new to an account without a known device', () => {
    expect(isNewDevice(FIREFOX_ON_WINDOWS, [])).toBe(true);
  });

  it('matches an unknown device only with an unknown device', () => {
    const unknown: DeviceIdentity = { type: 'unknown', browser: null, os: null };

    expect(isNewDevice(unknown, [unknown])).toBe(false);
    expect(isNewDevice(unknown, [FIREFOX_ON_WINDOWS])).toBe(true);
  });

  it('looks 90 days back', () => {
    expect(NEW_DEVICE_LOOKBACK_MS).toBe(90 * 24 * 60 * 60_000);
  });
});
