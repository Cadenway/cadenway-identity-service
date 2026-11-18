import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { FindOwnedOrganizations } from '../../../../application/use-cases/queries/membership/find-owned-organizations/find-owned-organizations.use-case.js';
import { SYSTEM_UNIT_OF_WORK } from '../../../tokens/membership/system-unit-of-work.token.js';

/**
 * Constant findOwnedOrganizationsProvider
 *
 * @description
 * Builds the public reading of the owned organizations on the system unit of work, which joins the
 * system transaction of its caller.
 *
 * @type {FactoryProvider<FindOwnedOrganizations>}
 */
export const findOwnedOrganizationsProvider: FactoryProvider<FindOwnedOrganizations> = {
  provide: FindOwnedOrganizations,
  inject: [SYSTEM_UNIT_OF_WORK],
  useFactory: (unitOfWork: MembershipsUnitOfWork): FindOwnedOrganizations =>
    new FindOwnedOrganizations(unitOfWork),
};
