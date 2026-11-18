import type { FactoryProvider } from '@nestjs/common';

import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { ResetLinkSecrets } from '../../../../application/ports/outbound/security/password-reset/reset-link-secrets.port.js';
import { RequestPasswordReset } from '../../../../application/use-cases/commands/password-reset/request-password-reset/request-password-reset.use-case.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { RESET_LINK_SECRETS } from '../../../tokens/accounts/reset-link-secrets.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant requestPasswordResetProvider
 *
 * @description
 * Builds the request of a password reset link.
 *
 * @type {FactoryProvider<RequestPasswordReset>}
 */
export const requestPasswordResetProvider: FactoryProvider<RequestPasswordReset> = {
  provide: RequestPasswordReset,
  inject: [UNIT_OF_WORK, RESET_LINK_SECRETS, DEVICE_READER, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    resetSecrets: ResetLinkSecrets,
    devices: DeviceReader,
    clock: Clock,
  ): RequestPasswordReset => new RequestPasswordReset(unitOfWork, resetSecrets, devices, clock),
};
