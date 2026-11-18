import { verify } from 'otplib';

import type { Totp } from '../../../application/ports/outbound/security/two-step/totp.port.js';

/**
 * Constant ISSUER
 *
 * @description
 * The issuer label authenticator apps show, fixed in code (`p2c2-consumers`: not configuration).
 *
 * @type {string}
 */
const ISSUER: string = 'Cadenway';

/**
 * Class OtplibTotp
 *
 * @description
 * `Totp` with `otplib` 13 (RFC 6238, decision 7 of P2c): SHA-1, 6 digits, 30-second steps, and an
 * `epochTolerance` of 30 seconds, one step either way. `afterTimeStep` refuses the step of the
 * last accepted code and every earlier one, so a code is accepted once and an older code never
 * after a newer one. The comparison is constant-time (otplib).
 */
export class OtplibTotp implements Totp {
  // #region Methods
  /**
   * Method verify
   *
   * @description
   * Checks a code at an instant.
   *
   * @param {string} secret - The secret, base32.
   * @param {string} code - The 6 digits.
   * @param {Date} at - The instant of the answer.
   * @param {number | null} afterTimeStep - The last accepted time step, or `null`.
   * @returns {Promise<number | null>} The time step of the code, or `null`.
   */
  public async verify(
    secret: string,
    code: string,
    at: Date,
    afterTimeStep: number | null,
  ): Promise<number | null> {
    if (!/^[0-9]{6}$/u.test(code)) {
      return null;
    }
    // The latest step a code may have is the next one; a last accepted step at or beyond it leaves
    // nothing to accept (a step stored by a replica whose clock ran ahead), which otplib reports by
    // throwing.
    if (afterTimeStep !== null && afterTimeStep >= Math.floor(at.getTime() / 30_000) + 1) {
      return null;
    }
    const result = await verify({
      secret,
      token: code,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      epoch: Math.floor(at.getTime() / 1000),
      epochTolerance: 30,
      ...(afterTimeStep === null ? {} : { afterTimeStep }),
    });
    return result.valid && 'timeStep' in result ? result.timeStep : null;
  }

  /**
   * Method uriOf
   *
   * @description
   * The `otpauth://totp/Cadenway:<address>` URI of the secret, with its parameters spelled out as
   * the contract's example does, for the apps that do not assume them.
   *
   * @param {string} secret - The secret, base32.
   * @param {string} accountName - The address of the account.
   * @returns {string} The URI.
   */
  public uriOf(secret: string, accountName: string): string {
    return `otpauth://totp/${ISSUER}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${ISSUER}&algorithm=SHA1&digits=6&period=30`;
  }
  // #endregion
}
