import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AuthenticatorAppSecrets } from '../../../../application/ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import type { Totp } from '../../../../application/ports/outbound/security/two-step/totp.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { StartAuthenticatorAppSetup } from '../../../../application/use-cases/commands/two-step/start-authenticator-app-setup/start-authenticator-app-setup.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { AUTHENTICATOR_APP_SECRETS } from '../../../tokens/two-step/authenticator-app-secrets.token.js';
import { TOTP } from '../../../tokens/two-step/totp.token.js';

/**
 * Constant startAuthenticatorAppSetupProvider
 *
 * @description
 * Builds `StartAuthenticatorAppSetup` on the system unit of work of the accounts module.
 *
 * @type {FactoryProvider<StartAuthenticatorAppSetup>}
 */
export const startAuthenticatorAppSetupProvider: FactoryProvider<StartAuthenticatorAppSetup> = {
  provide: StartAuthenticatorAppSetup,
  inject: [UNIT_OF_WORK, ACCOUNT_SESSIONS, AUTHENTICATOR_APP_SECRETS, TOTP, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    appSecrets: AuthenticatorAppSecrets,
    totp: Totp,
    clock: Clock,
  ): StartAuthenticatorAppSetup =>
    new StartAuthenticatorAppSetup(unitOfWork, sessions, appSecrets, totp, clock),
};
