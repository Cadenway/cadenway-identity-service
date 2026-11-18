import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { TwoStepEnrollments } from '../../../../application/ports/outbound/identity/sessions/two-step-enrollments.port.js';
import type { TwoStepRequirements } from '../../../../application/ports/outbound/identity/sessions/two-step-requirements.port.js';
import type { AuthenticatorAppSecrets } from '../../../../application/ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import type { BackupCodeSecrets } from '../../../../application/ports/outbound/security/two-step/backup-code-secrets.port.js';
import type { Totp } from '../../../../application/ports/outbound/security/two-step/totp.port.js';
import type { WebAuthn } from '../../../../application/ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { ConfirmAuthenticatorAppSetup } from '../../../../application/use-cases/commands/two-step/confirm-authenticator-app-setup/confirm-authenticator-app-setup.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { AUTHENTICATOR_APP_SECRETS } from '../../../tokens/two-step/authenticator-app-secrets.token.js';
import { BACKUP_CODE_SECRETS } from '../../../tokens/two-step/backup-code-secrets.token.js';
import { TOTP } from '../../../tokens/two-step/totp.token.js';
import { TWO_STEP_ENROLLMENTS } from '../../../tokens/two-step/two-step-enrollments.token.js';
import { TWO_STEP_REQUIREMENTS } from '../../../tokens/two-step/two-step-requirements.token.js';
import { WEB_AUTHN } from '../../../tokens/two-step/web-authn.token.js';

/**
 * Constant confirmAuthenticatorAppSetupProvider
 *
 * @description
 * Builds `ConfirmAuthenticatorAppSetup` on the system unit of work of the accounts module, which the sessions module joins.
 *
 * @type {FactoryProvider<ConfirmAuthenticatorAppSetup>}
 */
export const confirmAuthenticatorAppSetupProvider: FactoryProvider<ConfirmAuthenticatorAppSetup> = {
  provide: ConfirmAuthenticatorAppSetup,
  inject: [
    UNIT_OF_WORK,
    ACCOUNT_SESSIONS,
    AUTHENTICATOR_APP_SECRETS,
    TOTP,
    BACKUP_CODE_SECRETS,
    WEB_AUTHN,
    TWO_STEP_ENROLLMENTS,
    TWO_STEP_REQUIREMENTS,
    DEVICE_READER,
    CLOCK,
  ],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    appSecrets: AuthenticatorAppSecrets,
    totp: Totp,
    backupCodeSecrets: BackupCodeSecrets,
    webAuthn: WebAuthn,
    enrollments: TwoStepEnrollments,
    requirements: TwoStepRequirements,
    devices: DeviceReader,
    clock: Clock,
  ): ConfirmAuthenticatorAppSetup =>
    new ConfirmAuthenticatorAppSetup(
      unitOfWork,
      sessions,
      appSecrets,
      totp,
      backupCodeSecrets,
      webAuthn,
      enrollments,
      requirements,
      devices,
      clock,
    ),
};
