import { generate } from 'otplib';
import { describe, expect, it } from 'vitest';

import { OtplibTotp } from './otplib-totp.adapter.js';

/**
 * Constant SECRET
 *
 * @description
 * A base32 secret of 160 bits for the specs only.
 *
 * @type {string}
 */
const SECRET: string = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

/**
 * Constant NOW
 *
 * @description
 * The instant of the checks, at the start of a 30-second step.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-09T13:12:00Z');

/**
 * Function codeAt
 *
 * @description
 * The code an authenticator app shows at an instant (RFC 6238, SHA-1, 6 digits, 30 seconds).
 *
 * @param {Date} at - The instant.
 * @returns {Promise<string>} The 6 digits.
 */
async function codeAt(at: Date): Promise<string> {
  return generate({ secret: SECRET, epoch: Math.floor(at.getTime() / 1000) });
}

describe('OtplibTotp', () => {
  const totp: OtplibTotp = new OtplibTotp();
  const step: number = Math.floor(NOW.getTime() / 30_000);

  it('accepts the code of the current step and returns that step', async () => {
    await expect(totp.verify(SECRET, await codeAt(NOW), NOW, null)).resolves.toBe(step);
  });

  it('accepts one step of drift either way, and no more', async () => {
    await expect(
      totp.verify(SECRET, await codeAt(new Date(NOW.getTime() - 30_000)), NOW, null),
    ).resolves.toBe(step - 1);
    await expect(
      totp.verify(SECRET, await codeAt(new Date(NOW.getTime() + 30_000)), NOW, null),
    ).resolves.toBe(step + 1);
    await expect(
      totp.verify(SECRET, await codeAt(new Date(NOW.getTime() - 60_000)), NOW, null),
    ).resolves.toBeNull();
    await expect(
      totp.verify(SECRET, await codeAt(new Date(NOW.getTime() + 60_000)), NOW, null),
    ).resolves.toBeNull();
  });

  it('refuses a code of a step already accepted, so a code works once', async () => {
    const code: string = await codeAt(NOW);

    await expect(totp.verify(SECRET, code, NOW, step)).resolves.toBeNull();
    await expect(
      totp.verify(SECRET, await codeAt(new Date(NOW.getTime() - 30_000)), NOW, step),
    ).resolves.toBeNull();
    await expect(
      totp.verify(SECRET, await codeAt(new Date(NOW.getTime() + 30_000)), NOW, step),
    ).resolves.toBe(step + 1);
  });

  it('refuses every code, without an error, when the last accepted step is ahead of the clock', async () => {
    await expect(totp.verify(SECRET, await codeAt(NOW), NOW, step + 1)).resolves.toBeNull();
    await expect(totp.verify(SECRET, await codeAt(NOW), NOW, step + 40)).resolves.toBeNull();
  });

  it('refuses a malformed code without checking it', async () => {
    await expect(totp.verify(SECRET, '12345', NOW, null)).resolves.toBeNull();
    await expect(totp.verify(SECRET, '12345a', NOW, null)).resolves.toBeNull();
  });

  it('writes the otpauth URI the apps read, with the address of the account', () => {
    expect(totp.uriOf(SECRET, 'camille.martin@ateliernord.fr')).toBe(
      `otpauth://totp/Cadenway:camille.martin%40ateliernord.fr?secret=${SECRET}&issuer=Cadenway&algorithm=SHA1&digits=6&period=30`,
    );
  });
});
