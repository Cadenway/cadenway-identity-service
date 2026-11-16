import { describe, expect, it } from 'vitest';

import { EmbeddedCompromisedPasswords } from './embedded-compromised-passwords.adapter.js';

describe('EmbeddedCompromisedPasswords', () => {
  const list: EmbeddedCompromisedPasswords = new EmbeddedCompromisedPasswords();

  it('refuses an obviously weak password whatever its case', async () => {
    await expect(list.includes('password1234')).resolves.toBe(true);
    await expect(list.includes('Password1234')).resolves.toBe(true);
    await expect(list.includes('AZERTYUIOP123')).resolves.toBe(true);
  });

  it('accepts the password of the mockup examples', async () => {
    await expect(list.includes('atelier-nord-sprint-14')).resolves.toBe(false);
  });
});
