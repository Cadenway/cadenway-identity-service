import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { SessionOpener } from '../../../../application/ports/outbound/identity/sessions/session-opener.port.js';
import type { OneTimeCodeSecrets } from '../../../../application/ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { SignInWithCode } from '../../../../application/use-cases/commands/authentication/sign-in-with-code/sign-in-with-code.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { CODE_SECRETS } from '../../../tokens/accounts/one-time-code-secrets.token.js';
import { SESSION_OPENER } from '../../../tokens/accounts/session-opener.token.js';

/**
 * Constant signInWithCodeProvider
 *
 * @description
 * Builds SignInWithCode with the dependencies configured by the Accounts module.
 *
 * @type {FactoryProvider<SignInWithCode>}
 */
export const signInWithCodeProvider: FactoryProvider<SignInWithCode> = {
  provide: SignInWithCode,
  inject: [UNIT_OF_WORK, CODE_SECRETS, SESSION_OPENER, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    sessions: SessionOpener,
    clock: Clock,
  ): SignInWithCode => new SignInWithCode(unitOfWork, secrets, sessions, clock),
};
