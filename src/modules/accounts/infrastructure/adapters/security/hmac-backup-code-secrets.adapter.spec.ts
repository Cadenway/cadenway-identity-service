import { describe, expect, it } from 'vitest';

import { HmacBackupCodeSecrets } from './hmac-backup-code-secrets.adapter.js';

/**
 * Constant PEPPER
 *
 * @description
 * A pepper for the specs only.
 *
 * @type {string}
 */
const PEPPER: string = 'unit-test-password-pepper-00000000000000';

/**
 * Constant CAMILLE_ID
 *
 * @description
 * Id of the account of Camille Martin.
 *
 * @type {string}
 */
const CAMILLE_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';

describe('HmacBackupCodeSecrets', () => {
  const secrets: HmacBackupCodeSecrets = new HmacBackupCodeSecrets(PEPPER);

  it('draws 10 codes XXXX-XXXX of digits and capital letters', () => {
    const codes: string[] = secrets.generate();

    expect(codes).toHaveLength(10);
    expect(codes.every((code: string) => /^[0-9A-Z]{4}-[0-9A-Z]{4}$/u.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(10);
  });

  it('hashes an answer with or without its dash, in any case, to the same keyed hash', () => {
    const hash: string | null = secrets.hashOf(CAMILLE_ID, '4F7K-2M9Q');

    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(hash).not.toContain('4F7K');
    expect(secrets.hashOf(CAMILLE_ID, '4f7k2m9q')).toBe(hash);
    expect(secrets.hashOf(CAMILLE_ID, '4F7K2M9Q')).toBe(hash);
  });

  it('binds the hash to the account and to the pepper', () => {
    const hash: string | null = secrets.hashOf(CAMILLE_ID, '4F7K-2M9Q');

    expect(secrets.hashOf('019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31', '4F7K-2M9Q')).not.toBe(hash);
    expect(
      new HmacBackupCodeSecrets('another-unit-test-pepper-000000000000000').hashOf(
        CAMILLE_ID,
        '4F7K-2M9Q',
      ),
    ).not.toBe(hash);
  });

  it('has no hash for a malformed answer', () => {
    expect(secrets.hashOf(CAMILLE_ID, '4F7K-2M9')).toBeNull();
    expect(secrets.hashOf(CAMILLE_ID, '4F7K--2M9Q')).toBeNull();
    expect(secrets.hashOf(CAMILLE_ID, '4F7K 2M9Q')).toBeNull();
  });
});
