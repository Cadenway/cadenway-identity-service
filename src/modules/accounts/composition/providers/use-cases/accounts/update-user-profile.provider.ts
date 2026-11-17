import type { FactoryProvider } from '@nestjs/common';

import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { UpdateUserProfile } from '../../../../application/use-cases/commands/accounts/update-user-profile/update-user-profile.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant updateUserProfileProvider
 *
 * @description
 * Builds UpdateUserProfile on the unit of work of the Accounts module, which appends its event to
 * the outbox in the same transaction.
 *
 * @type {FactoryProvider<UpdateUserProfile>}
 */
export const updateUserProfileProvider: FactoryProvider<UpdateUserProfile> = {
  provide: UpdateUserProfile,
  inject: [UNIT_OF_WORK],
  useFactory: (unitOfWork: AccountsUnitOfWork): UpdateUserProfile =>
    new UpdateUserProfile(unitOfWork),
};
