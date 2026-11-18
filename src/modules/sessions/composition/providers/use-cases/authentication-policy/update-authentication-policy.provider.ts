import type { FactoryProvider } from '@nestjs/common';

import type { OrganizationMembers } from '../../../../application/ports/outbound/memberships/authentication-policy/organization-members.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { UpdateAuthenticationPolicy } from '../../../../application/use-cases/commands/authentication-policy/update-authentication-policy/update-authentication-policy.use-case.js';
import { ORGANIZATION_MEMBERS } from '../../../tokens/authentication-policy/organization-members.token.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { TENANT_UNIT_OF_WORK } from '../../../tokens/session/tenant-unit-of-work.token.js';

/**
 * Constant updateAuthenticationPolicyProvider
 *
 * @description
 * Builds `UpdateAuthenticationPolicy` on the tenant unit of work of the organization of the internal token.
 *
 * @type {FactoryProvider<UpdateAuthenticationPolicy>}
 */
export const updateAuthenticationPolicyProvider: FactoryProvider<UpdateAuthenticationPolicy> = {
  provide: UpdateAuthenticationPolicy,
  inject: [TENANT_UNIT_OF_WORK, ORGANIZATION_MEMBERS, CLOCK],
  useFactory: (
    unitOfWork: SessionsUnitOfWork,
    members: OrganizationMembers,
    clock: Clock,
  ): UpdateAuthenticationPolicy => new UpdateAuthenticationPolicy(unitOfWork, members, clock),
};
