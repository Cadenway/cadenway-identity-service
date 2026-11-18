import type { FactoryProvider } from '@nestjs/common';

import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { OneTimeCodeSecrets } from '../../../../application/ports/outbound/security/authentication/one-time-code-secrets.port.js';
import { ConfirmEmailChange } from '../../../../application/use-cases/commands/email-change/confirm-email-change/confirm-email-change.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { CODE_SECRETS } from '../../../tokens/accounts/one-time-code-secrets.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant confirmEmailChangeProvider
 *
 * @description
 * Builds the confirmation of a new address.
 *
 * @type {FactoryProvider<ConfirmEmailChange>}
 */
export const confirmEmailChangeProvider: FactoryProvider<ConfirmEmailChange> = {
  provide: ConfirmEmailChange,
  inject: [UNIT_OF_WORK, CODE_SECRETS, ACCOUNT_SESSIONS, DEVICE_READER, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    sessions: AccountSessions,
    devices: DeviceReader,
    clock: Clock,
  ): ConfirmEmailChange => new ConfirmEmailChange(unitOfWork, secrets, sessions, devices, clock),
};
