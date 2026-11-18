import type { FactoryProvider } from '@nestjs/common';

import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { CompromisedPasswords } from '../../../../application/ports/outbound/security/authentication/compromised-passwords.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { PasswordHasher } from '../../../../application/ports/outbound/security/authentication/password-hasher.port.js';
import type { ResetLinkSecrets } from '../../../../application/ports/outbound/security/password-reset/reset-link-secrets.port.js';
import { ConfirmPasswordReset } from '../../../../application/use-cases/commands/password-reset/confirm-password-reset/confirm-password-reset.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { COMPROMISED_PASSWORDS } from '../../../tokens/accounts/compromised-passwords.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { PASSWORD_HASHER } from '../../../tokens/accounts/password-hasher.token.js';
import { RESET_LINK_SECRETS } from '../../../tokens/accounts/reset-link-secrets.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant confirmPasswordResetProvider
 *
 * @description
 * Builds the new password chosen with a reset link.
 *
 * @type {FactoryProvider<ConfirmPasswordReset>}
 */
export const confirmPasswordResetProvider: FactoryProvider<ConfirmPasswordReset> = {
  provide: ConfirmPasswordReset,
  inject: [
    UNIT_OF_WORK,
    PASSWORD_HASHER,
    COMPROMISED_PASSWORDS,
    RESET_LINK_SECRETS,
    ACCOUNT_SESSIONS,
    DEVICE_READER,
    CLOCK,
    TRUSTED_DEVICES,
  ],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    compromised: CompromisedPasswords,
    resetSecrets: ResetLinkSecrets,
    sessions: AccountSessions,
    devices: DeviceReader,
    clock: Clock,
    trustedDevices: TrustedDevices,
  ): ConfirmPasswordReset =>
    new ConfirmPasswordReset(
      unitOfWork,
      hasher,
      compromised,
      resetSecrets,
      sessions,
      devices,
      clock,
      trustedDevices,
    ),
};
