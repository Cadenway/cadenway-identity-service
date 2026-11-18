import { describe, expect, it } from 'vitest';

import { AesAuthenticatorAppSecrets } from './aes-authenticator-app-secrets.adapter.js';

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

/**
 * Constant LEA_ID
 *
 * @description
 * Id of the account of Léa Petit.
 *
 * @type {string}
 */
const LEA_ID: string = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';

describe('AesAuthenticatorAppSecrets', () => {
  const secrets: AesAuthenticatorAppSecrets = new AesAuthenticatorAppSecrets(PEPPER);

  it('draws secrets of 160 bits in base32, each different', () => {
    const drawn: string[] = Array.from({ length: 50 }, () => secrets.generate());

    expect(drawn.every((secret: string) => /^[A-Z2-7]{32}$/u.test(secret))).toBe(true);
    expect(new Set(drawn).size).toBe(50);
  });

  it('seals a secret under the key version k1 and opens it for its account', () => {
    const secret: string = secrets.generate();
    const sealed: string = secrets.seal(CAMILLE_ID, secret);

    expect(sealed.split('.')).toHaveLength(4);
    expect(sealed.startsWith('k1.')).toBe(true);
    expect(sealed).not.toContain(secret);
    expect(secrets.open(CAMILLE_ID, sealed)).toBe(secret);
  });

  it('draws a new nonce for every seal', () => {
    const secret: string = secrets.generate();

    expect(secrets.seal(CAMILLE_ID, secret)).not.toBe(secrets.seal(CAMILLE_ID, secret));
  });

  it('refuses to open a secret for another account, a tampered one and another key', () => {
    const sealed: string = secrets.seal(CAMILLE_ID, secrets.generate());
    const [version, nonce, ciphertext, tag] = sealed.split('.');
    const tampered: string = [
      version,
      nonce,
      `${ciphertext?.startsWith('A') === true ? 'B' : 'A'}${ciphertext?.slice(1) ?? ''}`,
      tag,
    ].join('.');

    expect(() => secrets.open(LEA_ID, sealed)).toThrow();
    expect(() => secrets.open(CAMILLE_ID, tampered)).toThrow();
    expect(() =>
      new AesAuthenticatorAppSecrets('another-unit-test-pepper-000000000000000').open(
        CAMILLE_ID,
        sealed,
      ),
    ).toThrow();
  });

  it('refuses a sealed secret whose nonce or tag is not of its full length', () => {
    const sealed: string = secrets.seal(CAMILLE_ID, secrets.generate());
    const [version, nonce, ciphertext, tag] = sealed.split('.');
    const shortTag: string = Buffer.from(tag ?? '', 'base64url')
      .subarray(0, 12)
      .toString('base64url');
    const shortNonce: string = Buffer.from(nonce ?? '', 'base64url')
      .subarray(0, 8)
      .toString('base64url');

    expect(() =>
      secrets.open(CAMILLE_ID, [version, nonce, ciphertext, shortTag].join('.')),
    ).toThrow('unknown form');
    expect(() =>
      secrets.open(CAMILLE_ID, [version, shortNonce, ciphertext, tag].join('.')),
    ).toThrow('unknown form');
  });

  it('refuses a sealed secret of an unknown key version', () => {
    const sealed: string = secrets.seal(CAMILLE_ID, secrets.generate());

    expect(() => secrets.open(CAMILLE_ID, sealed.replace(/^k1\./u, 'k2.'))).toThrow('unknown form');
  });
});
