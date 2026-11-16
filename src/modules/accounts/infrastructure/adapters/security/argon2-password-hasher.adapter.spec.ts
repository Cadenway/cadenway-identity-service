import { describe, expect, it } from 'vitest';

import { Argon2PasswordHasher } from './argon2-password-hasher.adapter.js';

/**
 * Constant PEPPER
 *
 * @description
 * A pepper for the specs only.
 *
 * @type {string}
 */
const PEPPER: string = 'unit-test-password-pepper-00000000000000';

describe('Argon2PasswordHasher', () => {
  const hasher: Argon2PasswordHasher = new Argon2PasswordHasher(PEPPER);

  it('hashes with argon2id, m = 19456, t = 2, p = 1, and a fresh salt each time', async () => {
    const first: string = await hasher.hash('atelier-nord-sprint-14');
    const second: string = await hasher.hash('atelier-nord-sprint-14');

    expect(first).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/u,
    );
    expect(first).not.toBe(second);
    expect(first).not.toContain('atelier');
    expect(first).not.toContain(PEPPER);
  });

  it('verifies the right password and refuses another', async () => {
    const hash: string = await hasher.hash('atelier-nord-sprint-14');

    await expect(hasher.verify('atelier-nord-sprint-14', hash)).resolves.toBe(true);
    await expect(hasher.verify('atelier-nord-sprint-15', hash)).resolves.toBe(false);
  });

  it('depends on the pepper: another pepper does not verify the hash', async () => {
    const hash: string = await hasher.hash('atelier-nord-sprint-14');

    await expect(
      new Argon2PasswordHasher('another-password-pepper-0000000000000000').verify(
        'atelier-nord-sprint-14',
        hash,
      ),
    ).resolves.toBe(false);
  });

  it('normalizes the password to NFC, so a composed and a decomposed accent match', async () => {
    const hash: string = await hasher.hash('café-atelier-nord');

    await expect(hasher.verify('café-atelier-nord', hash)).resolves.toBe(true);
  });

  it('refuses without a hash, or with a malformed one, after the same work', async () => {
    await expect(hasher.verify('atelier-nord-sprint-14', null)).resolves.toBe(false);
    await expect(hasher.verify('atelier-nord-sprint-14', '$2b$10$bcrypt')).resolves.toBe(false);
  });
});
