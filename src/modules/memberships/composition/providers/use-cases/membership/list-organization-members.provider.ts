import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { ListOrganizationMembers } from '../../../../application/use-cases/queries/membership/list-organization-members/list-organization-members.use-case.js';
import { TENANT_UNIT_OF_WORK } from '../../../tokens/membership/tenant-unit-of-work.token.js';

/**
 * Constant listOrganizationMembersProvider
 *
 * @description
 * Builds the listing of the active members of an organization on the tenant unit of work, which joins the tenant transaction of its caller (the counts of the authentication policy).
 *
 * @type {FactoryProvider<ListOrganizationMembers>}
 */
export const listOrganizationMembersProvider: FactoryProvider<ListOrganizationMembers> = {
  provide: ListOrganizationMembers,
  inject: [TENANT_UNIT_OF_WORK],
  useFactory: (unitOfWork: MembershipsUnitOfWork): ListOrganizationMembers =>
    new ListOrganizationMembers(unitOfWork),
};
