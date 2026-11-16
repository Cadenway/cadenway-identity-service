import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { CompromisedPasswords } from '../../../../application/ports/outbound/security/authentication/compromised-passwords.port.js';
import type { OneTimeCodeSecrets } from '../../../../application/ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { PasswordHasher } from '../../../../application/ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { SignUp } from '../../../../application/use-cases/commands/authentication/sign-up/sign-up.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { COMPROMISED_PASSWORDS } from '../../../tokens/accounts/compromised-passwords.token.js';
import { CODE_SECRETS } from '../../../tokens/accounts/one-time-code-secrets.token.js';
import { PASSWORD_HASHER } from '../../../tokens/accounts/password-hasher.token.js';

/**
 * Constant signUpProvider
 *
 * @description
 * Builds SignUp with the dependencies configured by the Accounts module.
 *
 * @type {FactoryProvider<SignUp>}
 */
export const signUpProvider: FactoryProvider<SignUp> = {
  provide: SignUp,
  inject: [UNIT_OF_WORK, PASSWORD_HASHER, COMPROMISED_PASSWORDS, CODE_SECRETS, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    compromised: CompromisedPasswords,
    secrets: OneTimeCodeSecrets,
    clock: Clock,
  ): SignUp => new SignUp(unitOfWork, hasher, compromised, secrets, clock),
};
