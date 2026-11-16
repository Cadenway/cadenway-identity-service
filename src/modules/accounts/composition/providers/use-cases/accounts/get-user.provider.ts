import type { FactoryProvider } from '@nestjs/common';

import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { GetUser } from '../../../../application/use-cases/queries/accounts/get-user/get-user.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';

/**
 * Constant getUserProvider
 *
 * @description
 * Builds GetUser with the dependencies configured by the Accounts module.
 *
 * @type {FactoryProvider<GetUser>}
 */
export const getUserProvider: FactoryProvider<GetUser> = {
  provide: GetUser,
  inject: [UNIT_OF_WORK],
  useFactory: (unitOfWork: AccountsUnitOfWork): GetUser => new GetUser(unitOfWork),
};
