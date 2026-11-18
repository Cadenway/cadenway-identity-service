import type { ClassProvider } from '@nestjs/common';

import type { Totp } from '../../../../application/ports/outbound/security/two-step/totp.port.js';
import { OtplibTotp } from '../../../../infrastructure/adapters/security/otplib-totp.adapter.js';
import { TOTP } from '../../../tokens/two-step/totp.token.js';

/**
 * Constant totpProvider
 *
 * @description
 * Checks the codes of the authenticator apps with otplib (RFC 6238).
 *
 * @type {ClassProvider<Totp>}
 */
export const totpProvider: ClassProvider<Totp> = {
  provide: TOTP,
  useClass: OtplibTotp,
};
