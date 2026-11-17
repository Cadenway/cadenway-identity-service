import { describe, expect, it } from 'vitest';

import { isIanaTimeZone } from './time-zone.validator.js';

describe('isIanaTimeZone', () => {
  it('accepts the IANA names the runtime knows, canonical or not', () => {
    for (const zone of ['Europe/Paris', 'America/Montreal', 'UTC', 'Etc/GMT+1', 'Asia/Calcutta']) {
      expect(isIanaTimeZone(zone)).toBe(true);
    }
  });

  it('refuses an unknown name, an offset, and a value that is not a name', () => {
    for (const zone of ['Europe/Atlantis', '+01:00', 'Paris ', '', 'Europe/../Paris', 'CET;']) {
      expect(isIanaTimeZone(zone)).toBe(false);
    }
  });
});
