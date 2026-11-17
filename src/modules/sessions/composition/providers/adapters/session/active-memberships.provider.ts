import type { FactoryProvider } from '@nestjs/common';

import { FindActiveMembership } from '../../../../../memberships/public/membership/find-active-membership.js';
import type { FindActiveMembershipOutput } from '../../../../../memberships/public/membership/find-active-membership.js';
import type { ActiveMembership } from '../../../../application/models/session/active-membership.model.js';
import type { ActiveMemberships } from '../../../../application/ports/outbound/memberships/session/active-memberships.port.js';
import { ACTIVE_MEMBERSHIPS } from '../../../tokens/session/active-memberships.token.js';

/**
 * Constant activeMembershipsProvider
 *
 * @description
 * Binds the ActiveMemberships port of the sessions module to `FindActiveMembership`, the provider
 * `MembershipsModule` exports. Called inside a unit of work of this module, the reading joins its
 * system transaction.
 *
 * @type {FactoryProvider<ActiveMemberships>}
 */
export const activeMembershipsProvider: FactoryProvider<ActiveMemberships> = {
  provide: ACTIVE_MEMBERSHIPS,
  inject: [FindActiveMembership],
  useFactory: (findActiveMembership: FindActiveMembership): ActiveMemberships => ({
    find: async (organizationId: string, userId: string): Promise<ActiveMembership | null> => {
      const membership: FindActiveMembershipOutput | null = await findActiveMembership.execute({
        organizationId,
        userId,
      });
      return membership === null
        ? null
        : {
            memberId: membership.memberId,
            organizationId: membership.organizationId,
            role: membership.role,
          };
    },
  }),
};
