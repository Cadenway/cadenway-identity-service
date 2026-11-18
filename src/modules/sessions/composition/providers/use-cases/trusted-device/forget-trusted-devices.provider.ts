import type { FactoryProvider } from '@nestjs/common';

import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { ForgetTrustedDevices } from '../../../../application/use-cases/commands/trusted-device/forget-trusted-devices/forget-trusted-devices.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant forgetTrustedDevicesProvider
 *
 * @description
 * Builds `ForgetTrustedDevices` on the system unit of work, which joins the transaction of its caller.
 *
 * @type {FactoryProvider<ForgetTrustedDevices>}
 */
export const forgetTrustedDevicesProvider: FactoryProvider<ForgetTrustedDevices> = {
  provide: ForgetTrustedDevices,
  inject: [UNIT_OF_WORK],
  useFactory: (unitOfWork: SessionsUnitOfWork): ForgetTrustedDevices =>
    new ForgetTrustedDevices(unitOfWork),
};
