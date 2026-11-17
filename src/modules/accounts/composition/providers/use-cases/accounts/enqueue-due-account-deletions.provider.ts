import type { FactoryProvider } from '@nestjs/common';

import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import { EnqueueDueAccountDeletions } from '../../../../application/use-cases/commands/deletion/enqueue-due-account-deletions/enqueue-due-account-deletions.use-case.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant enqueueDueAccountDeletionsProvider
 *
 * @description
 * Builds the sweep of the due deletions.
 *
 * @type {FactoryProvider<EnqueueDueAccountDeletions>}
 */
export const enqueueDueAccountDeletionsProvider: FactoryProvider<EnqueueDueAccountDeletions> = {
  provide: EnqueueDueAccountDeletions,
  inject: [UNIT_OF_WORK, CLOCK],
  useFactory: (unitOfWork: AccountsUnitOfWork, clock: Clock): EnqueueDueAccountDeletions =>
    new EnqueueDueAccountDeletions(unitOfWork, clock),
};
