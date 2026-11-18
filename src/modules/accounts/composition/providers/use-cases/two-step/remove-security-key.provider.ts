import type { FactoryProvider } from '@nestjs/common';

import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { RemoveSecurityKey } from '../../../../application/use-cases/commands/two-step/remove-security-key/remove-security-key.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';

/**
 * Constant removeSecurityKeyProvider
 *
 * @description
 * Builds `RemoveSecurityKey` on the system unit of work of the accounts module.
 *
 * @type {FactoryProvider<RemoveSecurityKey>}
 */
export const removeSecurityKeyProvider: FactoryProvider<RemoveSecurityKey> = {
  provide: RemoveSecurityKey,
  inject: [UNIT_OF_WORK, ACCOUNT_SESSIONS, DEVICE_READER],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    devices: DeviceReader,
  ): RemoveSecurityKey => new RemoveSecurityKey(unitOfWork, sessions, devices),
};
