import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { WebAuthn } from '../../../../application/ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { StartSecurityKeyRegistration } from '../../../../application/use-cases/commands/two-step/start-security-key-registration/start-security-key-registration.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { WEB_AUTHN } from '../../../tokens/two-step/web-authn.token.js';

/**
 * Constant startSecurityKeyRegistrationProvider
 *
 * @description
 * Builds `StartSecurityKeyRegistration` on the system unit of work of the accounts module.
 *
 * @type {FactoryProvider<StartSecurityKeyRegistration>}
 */
export const startSecurityKeyRegistrationProvider: FactoryProvider<StartSecurityKeyRegistration> = {
  provide: StartSecurityKeyRegistration,
  inject: [UNIT_OF_WORK, ACCOUNT_SESSIONS, WEB_AUTHN, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    webAuthn: WebAuthn,
    clock: Clock,
  ): StartSecurityKeyRegistration =>
    new StartSecurityKeyRegistration(unitOfWork, sessions, webAuthn, clock),
};
