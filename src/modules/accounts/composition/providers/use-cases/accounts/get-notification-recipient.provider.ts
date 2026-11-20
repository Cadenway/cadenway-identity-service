import type { FactoryProvider } from '@nestjs/common';

import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { GetNotificationRecipient } from '../../../../application/use-cases/queries/accounts/get-notification-recipient/get-notification-recipient.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/** Reuses the Accounts system transaction for the recipient lookup. */
export const getNotificationRecipientProvider: FactoryProvider<GetNotificationRecipient> = {
  provide: GetNotificationRecipient,
  inject: [UNIT_OF_WORK],
  useFactory: (work: AccountsUnitOfWork): GetNotificationRecipient =>
    new GetNotificationRecipient(work),
};
