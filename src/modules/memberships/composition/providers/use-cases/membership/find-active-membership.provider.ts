import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { FindActiveMembership } from '../../../../application/use-cases/queries/membership/find-active-membership/find-active-membership.use-case.js';
import { SYSTEM_UNIT_OF_WORK } from '../../../tokens/membership/system-unit-of-work.token.js';

/**
 * Constant findActiveMembershipProvider
 *
 * @description
 * Builds the public reading of the copy on the system unit of work, which joins the system
 * transaction of its caller.
 *
 * @type {FactoryProvider<FindActiveMembership>}
 */
export const findActiveMembershipProvider: FactoryProvider<FindActiveMembership> = {
  provide: FindActiveMembership,
  inject: [SYSTEM_UNIT_OF_WORK],
  useFactory: (unitOfWork: MembershipsUnitOfWork): FindActiveMembership =>
    new FindActiveMembership(unitOfWork),
};
