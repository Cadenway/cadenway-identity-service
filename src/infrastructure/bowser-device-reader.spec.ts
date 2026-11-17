import { describe, expect, it } from 'vitest';

import { BowserDeviceReader } from './bowser-device-reader.js';

describe('BowserDeviceReader', () => {
  const reader: BowserDeviceReader = new BowserDeviceReader();

  it('reads Firefox on Windows, without the version Windows 10 and 11 share', () => {
    expect(
      reader.read(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
      ),
    ).toEqual({
      type: 'desktop',
      browser: 'Firefox',
      browserVersion: '132',
      os: 'Windows',
      osVersion: null,
    });
  });

  it('reads Safari on an iPhone, with the version of iOS', () => {
    expect(
      reader.read(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({
      type: 'mobile',
      browser: 'Safari',
      browserVersion: '18',
      os: 'iOS',
      osVersion: '18.1',
    });
  });

  it('leaves out the frozen version of macOS', () => {
    expect(
      reader.read(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ),
    ).toEqual({
      type: 'desktop',
      browser: 'Chrome',
      browserVersion: '131',
      os: 'macOS',
      osVersion: null,
    });
  });

  it('describes an unknown device without a header, or for one it cannot read', () => {
    const unknown: object = {
      type: 'unknown',
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
    };

    expect(reader.read(null)).toEqual(unknown);
    expect(reader.read('  ')).toEqual(unknown);
    expect(reader.read('curl/8.5.0')).toMatchObject({ type: 'unknown', os: null });
  });

  it('cuts a name to the length the events accept', () => {
    const device = reader.read(`Mozilla/5.0 (X11; Linux x86_64) ${'A'.repeat(200)}/1.0`);

    expect(device.browser?.length ?? 0).toBeLessThanOrEqual(60);
    expect(device.os?.length ?? 0).toBeLessThanOrEqual(60);
  });
});
