import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { OneTimeCodeSecrets } from '../../../../application/ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { RequestSignInCode } from '../../../../application/use-cases/commands/authentication/request-sign-in-code/request-sign-in-code.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { CODE_SECRETS } from '../../../tokens/accounts/one-time-code-secrets.token.js';

/**
 * Constant requestSignInCodeProvider
 *
 * @description
 * Builds RequestSignInCode with the dependencies configured by the Accounts module.
 *
 * @type {FactoryProvider<RequestSignInCode>}
 */
export const requestSignInCodeProvider: FactoryProvider<RequestSignInCode> = {
  provide: RequestSignInCode,
  inject: [UNIT_OF_WORK, CODE_SECRETS, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    clock: Clock,
  ): RequestSignInCode => new RequestSignInCode(unitOfWork, secrets, clock),
};
