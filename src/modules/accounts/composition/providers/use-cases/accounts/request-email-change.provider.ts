import type { FactoryProvider } from '@nestjs/common';

import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { OneTimeCodeSecrets } from '../../../../application/ports/outbound/security/authentication/one-time-code-secrets.port.js';
import { RequestEmailChange } from '../../../../application/use-cases/commands/email-change/request-email-change/request-email-change.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { CODE_SECRETS } from '../../../tokens/accounts/one-time-code-secrets.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant requestEmailChangeProvider
 *
 * @description
 * Builds the request of a change of address.
 *
 * @type {FactoryProvider<RequestEmailChange>}
 */
export const requestEmailChangeProvider: FactoryProvider<RequestEmailChange> = {
  provide: RequestEmailChange,
  inject: [UNIT_OF_WORK, CODE_SECRETS, ACCOUNT_SESSIONS, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    sessions: AccountSessions,
    clock: Clock,
  ): RequestEmailChange => new RequestEmailChange(unitOfWork, secrets, sessions, clock),
};
