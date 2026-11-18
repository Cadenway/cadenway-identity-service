import type { FactoryProvider } from '@nestjs/common';

import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import type { AccountApiTokens } from '../../../../application/ports/outbound/identity/api-tokens/account-api-tokens.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { OwnedOrganizations } from '../../../../application/ports/outbound/memberships/accounts/owned-organizations.port.js';
import { ScheduleAccountDeletion } from '../../../../application/use-cases/commands/deletion/schedule-account-deletion/schedule-account-deletion.use-case.js';
import { ACCOUNT_API_TOKENS } from '../../../tokens/accounts/account-api-tokens.token.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { OWNED_ORGANIZATIONS } from '../../../tokens/accounts/owned-organizations.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant scheduleAccountDeletionProvider
 *
 * @description
 * Builds the scheduling of the deletion of an account.
 *
 * @type {FactoryProvider<ScheduleAccountDeletion>}
 */
export const scheduleAccountDeletionProvider: FactoryProvider<ScheduleAccountDeletion> = {
  provide: ScheduleAccountDeletion,
  inject: [
    UNIT_OF_WORK,
    ACCOUNT_SESSIONS,
    ACCOUNT_API_TOKENS,
    OWNED_ORGANIZATIONS,
    CLOCK,
    TRUSTED_DEVICES,
  ],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    apiTokens: AccountApiTokens,
    ownedOrganizations: OwnedOrganizations,
    clock: Clock,
    trustedDevices: TrustedDevices,
  ): ScheduleAccountDeletion =>
    new ScheduleAccountDeletion(
      unitOfWork,
      sessions,
      apiTokens,
      ownedOrganizations,
      clock,
      trustedDevices,
    ),
};
