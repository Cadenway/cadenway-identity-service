import type { FactoryProvider } from '@nestjs/common';

import type { MembershipsUnitOfWork } from '../../../../application/ports/outbound/transactions/membership/memberships-unit-of-work.port.js';
import { FindOrganizationMember } from '../../../../application/use-cases/queries/membership/find-organization-member/find-organization-member.use-case.js';
import { TENANT_UNIT_OF_WORK } from '../../../tokens/membership/tenant-unit-of-work.token.js';

/**
 * Constant findOrganizationMemberProvider
 *
 * @description
 * Builds the reading of the role of a member on the tenant unit of work, which joins the tenant transaction of its caller (the authentication policy routes of the sessions module).
 *
 * @type {FactoryProvider<FindOrganizationMember>}
 */
export const findOrganizationMemberProvider: FactoryProvider<FindOrganizationMember> = {
  provide: FindOrganizationMember,
  inject: [TENANT_UNIT_OF_WORK],
  useFactory: (unitOfWork: MembershipsUnitOfWork): FindOrganizationMember =>
    new FindOrganizationMember(unitOfWork),
};
