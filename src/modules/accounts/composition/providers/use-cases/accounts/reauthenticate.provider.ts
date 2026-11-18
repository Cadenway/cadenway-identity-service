import type { FactoryProvider } from '@nestjs/common';

import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { PasswordHasher } from '../../../../application/ports/outbound/security/authentication/password-hasher.port.js';
import { Reauthenticate } from '../../../../application/use-cases/commands/authentication/reauthenticate/reauthenticate.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { PASSWORD_HASHER } from '../../../tokens/accounts/password-hasher.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant reauthenticateProvider
 *
 * @description
 * Builds the confirmation of the password of a session.
 *
 * @type {FactoryProvider<Reauthenticate>}
 */
export const reauthenticateProvider: FactoryProvider<Reauthenticate> = {
  provide: Reauthenticate,
  inject: [UNIT_OF_WORK, PASSWORD_HASHER, ACCOUNT_SESSIONS, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    sessions: AccountSessions,
    clock: Clock,
  ): Reauthenticate => new Reauthenticate(unitOfWork, hasher, sessions, clock),
};
