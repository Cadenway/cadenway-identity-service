import type { FactoryProvider } from '@nestjs/common';

import { FindAuthoritativeMembership } from '../../../../../memberships/public/membership/find-authoritative-membership.js';
import type { ActiveMemberships } from '../../../../application/ports/outbound/memberships/session/active-memberships.port.js';
import type { Clock } from '../../../../application/ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { SwitchSessionOrganization } from '../../../../application/use-cases/commands/session/switch-session-organization/switch-session-organization.use-case.js';
import { ACTIVE_MEMBERSHIPS } from '../../../tokens/session/active-memberships.token.js';
import { CLOCK } from '../../../tokens/session/clock.token.js';
import { UNIT_OF_WORK } from '../../../tokens/session/unit-of-work.token.js';

/**
 * Constant switchSessionOrganizationProvider
 *
 * @description
 * Builds the choice of the current organization with the session transaction, the copy of the
 * memberships and the clock.
 *
 * @type {FactoryProvider<SwitchSessionOrganization>}
 */
export const switchSessionOrganizationProvider: FactoryProvider<SwitchSessionOrganization> = {
  provide: SwitchSessionOrganization,
  inject: [UNIT_OF_WORK, ACTIVE_MEMBERSHIPS, CLOCK, FindAuthoritativeMembership],
  useFactory: (
    unitOfWork: SessionsUnitOfWork,
    memberships: ActiveMemberships,
    systemClock: Clock,
    authority: FindAuthoritativeMembership | null,
  ): SwitchSessionOrganization =>
    new SwitchSessionOrganization(
      unitOfWork,
      memberships,
      systemClock,
      authority === null
        ? null
        : { find: (organizationId, userId) => authority.execute({ organizationId, userId }) },
    ),
};
