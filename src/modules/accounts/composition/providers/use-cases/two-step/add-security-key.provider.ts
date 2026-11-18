import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { WebAuthn } from '../../../../application/ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { AddSecurityKey } from '../../../../application/use-cases/commands/two-step/add-security-key/add-security-key.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { WEB_AUTHN } from '../../../tokens/two-step/web-authn.token.js';

/**
 * Constant addSecurityKeyProvider
 *
 * @description
 * Builds `AddSecurityKey` on the system unit of work of the accounts module.
 *
 * @type {FactoryProvider<AddSecurityKey>}
 */
export const addSecurityKeyProvider: FactoryProvider<AddSecurityKey> = {
  provide: AddSecurityKey,
  inject: [UNIT_OF_WORK, ACCOUNT_SESSIONS, WEB_AUTHN, DEVICE_READER, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    webAuthn: WebAuthn,
    devices: DeviceReader,
    clock: Clock,
  ): AddSecurityKey => new AddSecurityKey(unitOfWork, sessions, webAuthn, devices, clock),
};
