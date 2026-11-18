import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { FindUserMemberships } from '../../../../application/use-cases/queries/membership/find-user-memberships/find-user-memberships.use-case.js';
import { SYSTEM_UNIT_OF_WORK } from '../../../tokens/membership/system-unit-of-work.token.js';

/**
 * Constant findUserMembershipsProvider
 *
 * @description
 * Builds the reading of the active memberships of an account on the system unit of work, which joins the system transaction of its caller (the requirements of two-step verification of the sessions module).
 *
 * @type {FactoryProvider<FindUserMemberships>}
 */
export const findUserMembershipsProvider: FactoryProvider<FindUserMemberships> = {
  provide: FindUserMemberships,
  inject: [SYSTEM_UNIT_OF_WORK],
  useFactory: (unitOfWork: MembershipsUnitOfWork): FindUserMemberships =>
    new FindUserMemberships(unitOfWork),
};
