import type { FactoryProvider } from '@nestjs/common';

import type { SessionTokens } from '../../../../application/ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { TrustDevice } from '../../../../application/use-cases/commands/trusted-device/trust-device/trust-device.use-case.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { SESSION_TOKENS } from '../../../tokens/session/session-tokens.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant trustDeviceProvider
 *
 * @description
 * Builds `TrustDevice` on the system unit of work, which joins the transaction of the answer of a challenge.
 *
 * @type {FactoryProvider<TrustDevice>}
 */
export const trustDeviceProvider: FactoryProvider<TrustDevice> = {
  provide: TrustDevice,
  inject: [UNIT_OF_WORK, SESSION_TOKENS, CLOCK],
  useFactory: (unitOfWork: SessionsUnitOfWork, tokens: SessionTokens, clock: Clock): TrustDevice =>
    new TrustDevice(unitOfWork, tokens, clock),
};
