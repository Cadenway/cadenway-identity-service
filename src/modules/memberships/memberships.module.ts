import { Module } from '@nestjs/common';

import { memberEventsHandlerProvider } from './composition/providers/adapters/membership/member-events-handler.provider.js';
import { memberEventsRedeliveryProvider } from './composition/providers/adapters/membership/member-events-redelivery.provider.js';
import { systemUnitOfWorkProvider } from './composition/providers/adapters/membership/system-unit-of-work.provider.js';
import { tenantUnitOfWorkProvider } from './composition/providers/adapters/membership/tenant-unit-of-work.provider.js';
import { applyMembershipChangeProvider } from './composition/providers/use-cases/membership/apply-membership-change.provider.js';
import { findActiveMembershipProvider } from './composition/providers/use-cases/membership/find-active-membership.provider.js';
import { findOwnedOrganizationsProvider } from './composition/providers/use-cases/membership/find-owned-organizations.provider.js';
import { FindActiveMembership } from './public/membership/find-active-membership.js';
import { FindOwnedOrganizations } from './public/membership/find-owned-organizations.js';

/**
 * Class MembershipsModule
 *
 * @description
 * Composition root of the copy of the memberships of organization-service (see its `MODULE.md`):
 * the handler of the three member events with their redelivery schedule, and the reading the
 * sessions and api-tokens modules consume through `FindActiveMembership`, the provider it exports.
 */
@Module({
  providers: [
    tenantUnitOfWorkProvider,
    systemUnitOfWorkProvider,
    applyMembershipChangeProvider,
    findActiveMembershipProvider,
    findOwnedOrganizationsProvider,
    memberEventsRedeliveryProvider,
    memberEventsHandlerProvider,
  ],
  exports: [FindActiveMembership, FindOwnedOrganizations],
})
export class MembershipsModule {}
