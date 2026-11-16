import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { SessionOpener } from '../../../../application/ports/outbound/identity/sessions/session-opener.port.js';
import type { OneTimeCodeSecrets } from '../../../../application/ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { PasswordHasher } from '../../../../application/ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { VerifySignUp } from '../../../../application/use-cases/commands/authentication/verify-sign-up/verify-sign-up.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { CODE_SECRETS } from '../../../tokens/accounts/one-time-code-secrets.token.js';
import { PASSWORD_HASHER } from '../../../tokens/accounts/password-hasher.token.js';
import { SESSION_OPENER } from '../../../tokens/accounts/session-opener.token.js';

/**
 * Constant verifySignUpProvider
 *
 * @description
 * Builds VerifySignUp with the dependencies configured by the Accounts module.
 *
 * @type {FactoryProvider<VerifySignUp>}
 */
export const verifySignUpProvider: FactoryProvider<VerifySignUp> = {
  provide: VerifySignUp,
  inject: [UNIT_OF_WORK, CODE_SECRETS, PASSWORD_HASHER, SESSION_OPENER, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    hasher: PasswordHasher,
    sessions: SessionOpener,
    clock: Clock,
  ): VerifySignUp => new VerifySignUp(unitOfWork, secrets, hasher, sessions, clock),
};
