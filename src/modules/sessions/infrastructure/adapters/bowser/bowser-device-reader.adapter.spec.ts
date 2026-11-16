import { describe, expect, it } from 'vitest';

import { BowserDeviceReader } from './bowser-device-reader.adapter.js';

describe('BowserDeviceReader', () => {
  const reader: BowserDeviceReader = new BowserDeviceReader();

  it('reads the browser, the system and the kind of device of the contract example', () => {
    expect(
      reader.read(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
      ),
    ).toEqual({ browser: 'Firefox 145', operatingSystem: 'Windows 10', deviceType: 'desktop' });
  });

  it('reads a phone', () => {
    expect(
      reader.read(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      ),
    ).toMatchObject({ browser: 'Safari 18', deviceType: 'mobile' });
  });

  it('describes nothing without a header, or for one it cannot read', () => {
    const unknown: object = { browser: null, operatingSystem: null, deviceType: null };

    expect(reader.read(null)).toEqual(unknown);
    expect(reader.read('  ')).toEqual(unknown);
    expect(reader.read('curl')).toMatchObject({ deviceType: null });
  });
});
