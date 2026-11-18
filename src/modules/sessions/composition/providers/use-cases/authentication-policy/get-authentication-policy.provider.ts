import type { FactoryProvider } from '@nestjs/common';

import type { OrganizationMembers } from '../../../../application/ports/outbound/memberships/authentication-policy/organization-members.port.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { GetAuthenticationPolicy } from '../../../../application/use-cases/queries/authentication-policy/get-authentication-policy/get-authentication-policy.use-case.js';
import { ORGANIZATION_MEMBERS } from '../../../tokens/authentication-policy/organization-members.token.js';
import { TENANT_UNIT_OF_WORK } from '../../../tokens/session/tenant-unit-of-work.token.js';

/**
 * Constant getAuthenticationPolicyProvider
 *
 * @description
 * Builds `GetAuthenticationPolicy` on the tenant unit of work of the organization of the internal token.
 *
 * @type {FactoryProvider<GetAuthenticationPolicy>}
 */
export const getAuthenticationPolicyProvider: FactoryProvider<GetAuthenticationPolicy> = {
  provide: GetAuthenticationPolicy,
  inject: [TENANT_UNIT_OF_WORK, ORGANIZATION_MEMBERS],
  useFactory: (
    unitOfWork: SessionsUnitOfWork,
    members: OrganizationMembers,
  ): GetAuthenticationPolicy => new GetAuthenticationPolicy(unitOfWork, members),
};
