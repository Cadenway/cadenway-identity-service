import type { FactoryProvider } from '@nestjs/common';

import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { ResetLinkSecrets } from '../../../../application/ports/outbound/security/password-reset/reset-link-secrets.port.js';
import { InspectPasswordResetLink } from '../../../../application/use-cases/queries/password-reset/inspect-password-reset-link/inspect-password-reset-link.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { RESET_LINK_SECRETS } from '../../../tokens/accounts/reset-link-secrets.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant inspectPasswordResetLinkProvider
 *
 * @description
 * Builds the reading of a password reset link.
 *
 * @type {FactoryProvider<InspectPasswordResetLink>}
 */
export const inspectPasswordResetLinkProvider: FactoryProvider<InspectPasswordResetLink> = {
  provide: InspectPasswordResetLink,
  inject: [UNIT_OF_WORK, RESET_LINK_SECRETS, ACCOUNT_SESSIONS, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    resetSecrets: ResetLinkSecrets,
    sessions: AccountSessions,
    clock: Clock,
  ): InspectPasswordResetLink =>
    new InspectPasswordResetLink(unitOfWork, resetSecrets, sessions, clock),
};
