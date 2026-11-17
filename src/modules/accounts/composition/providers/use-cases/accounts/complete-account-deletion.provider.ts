import type { FactoryProvider } from '@nestjs/common';

import type { AccountApiTokens } from '../../../../application/ports/outbound/identity/api-tokens/account-api-tokens.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { OwnedOrganizations } from '../../../../application/ports/outbound/memberships/accounts/owned-organizations.port.js';
import { CompleteAccountDeletion } from '../../../../application/use-cases/commands/deletion/complete-account-deletion/complete-account-deletion.use-case.js';
import { ACCOUNT_API_TOKENS } from '../../../tokens/accounts/account-api-tokens.token.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { OWNED_ORGANIZATIONS } from '../../../tokens/accounts/owned-organizations.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant completeAccountDeletionProvider
 *
 * @description
 * Builds the deletion of an account at the end of its scheduled deletion.
 *
 * @type {FactoryProvider<CompleteAccountDeletion>}
 */
export const completeAccountDeletionProvider: FactoryProvider<CompleteAccountDeletion> = {
  provide: CompleteAccountDeletion,
  inject: [UNIT_OF_WORK, ACCOUNT_SESSIONS, ACCOUNT_API_TOKENS, OWNED_ORGANIZATIONS, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    apiTokens: AccountApiTokens,
    ownedOrganizations: OwnedOrganizations,
    clock: Clock,
  ): CompleteAccountDeletion =>
    new CompleteAccountDeletion(unitOfWork, sessions, apiTokens, ownedOrganizations, clock),
};
