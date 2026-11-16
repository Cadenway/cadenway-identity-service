import { describe, expect, it } from 'vitest';

import { HmacOneTimeCodeSecrets } from './hmac-one-time-code-secrets.adapter.js';

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

describe('HmacOneTimeCodeSecrets', () => {
  const secrets: HmacOneTimeCodeSecrets = new HmacOneTimeCodeSecrets(PEPPER);

  it('draws codes of 6 digits', () => {
    const codes: string[] = Array.from({ length: 200 }, () => secrets.generate());

    expect(codes.every((code: string) => /^\d{6}$/u.test(code))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(190);
  });

  it('hashes a code the same way each time, as 64 hexadecimal characters without the digits', () => {
    const hash: string = secrets.hash({ userId: CAMILLE_ID, purpose: 'sign-in', code: '482913' });

    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(hash).not.toContain('482913');
    expect(secrets.hash({ userId: CAMILLE_ID, purpose: 'sign-in', code: '482913' })).toBe(hash);
  });

  it('binds the account, the purpose and the key', () => {
    const hash: string = secrets.hash({ userId: CAMILLE_ID, purpose: 'sign-in', code: '482913' });

    expect(
      secrets.hash({ userId: CAMILLE_ID, purpose: 'email-verification', code: '482913' }),
    ).not.toBe(hash);
    expect(
      secrets.hash({
        userId: '019a5f3c-8d2e-7c4a-9b1f-ffffffffffff',
        purpose: 'sign-in',
        code: '482913',
      }),
    ).not.toBe(hash);
    expect(
      new HmacOneTimeCodeSecrets('another-password-pepper-0000000000000000').hash({
        userId: CAMILLE_ID,
        purpose: 'sign-in',
        code: '482913',
      }),
    ).not.toBe(hash);
  });
});
