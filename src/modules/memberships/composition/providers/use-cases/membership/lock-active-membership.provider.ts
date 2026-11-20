import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { LockActiveMembership } from '../../../../application/use-cases/queries/membership/lock-active-membership/lock-active-membership.use-case.js';
import { SYSTEM_UNIT_OF_WORK } from '../../../tokens/membership/system-unit-of-work.token.js';

/** Joins the caller's system transaction to hold the membership lock. */
export const lockActiveMembershipProvider: FactoryProvider<LockActiveMembership> = {
  provide: LockActiveMembership,
  inject: [SYSTEM_UNIT_OF_WORK],
  useFactory: (unitOfWork: MembershipsUnitOfWork): LockActiveMembership =>
    new LockActiveMembership(unitOfWork),
};
