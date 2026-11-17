import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { ApplyMembershipChange } from '../../../../application/use-cases/commands/membership/apply-membership-change/apply-membership-change.use-case.js';
import { TENANT_UNIT_OF_WORK } from '../../../tokens/membership/tenant-unit-of-work.token.js';

/**
 * Constant applyMembershipChangeProvider
 *
 * @description
 * Builds the use case of the member event handlers on the tenant unit of work.
 *
 * @type {FactoryProvider<ApplyMembershipChange>}
 */
export const applyMembershipChangeProvider: FactoryProvider<ApplyMembershipChange> = {
  provide: ApplyMembershipChange,
  inject: [TENANT_UNIT_OF_WORK],
  useFactory: (unitOfWork: MembershipsUnitOfWork): ApplyMembershipChange =>
    new ApplyMembershipChange(unitOfWork),
};
