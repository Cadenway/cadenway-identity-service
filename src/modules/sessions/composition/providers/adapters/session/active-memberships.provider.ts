import type { FactoryProvider } from '@nestjs/common';

import { FindActiveMembership } from '../../../../../memberships/public/membership/find-active-membership.js';
import type { FindActiveMembershipOutput } from '../../../../../memberships/public/membership/find-active-membership.js';
import { FindUserMemberships } from '../../../../../memberships/public/membership/find-user-memberships.js';
import type { FindUserMembershipsOutput } from '../../../../../memberships/public/membership/find-user-memberships.js';
import type { ActiveMembership } from '../../../../application/models/session/active-membership.model.js';
import type { UserMembership } from '../../../../application/models/session/user-membership.model.js';
import type { ActiveMemberships } from '../../../../application/ports/outbound/memberships/session/active-memberships.port.js';
import { ACTIVE_MEMBERSHIPS } from '../../../tokens/session/active-memberships.token.js';

/**
 * Constant activeMembershipsProvider
 *
 * @description
 * Binds the `ActiveMemberships` port of this module to the `FindActiveMembership` and
 * `FindUserMemberships` providers the memberships module exports. Both run in the system
 * transaction of their caller: called inside a unit of work of this module, they join it.
 *
 * @type {FactoryProvider<ActiveMemberships>}
 */
export const activeMembershipsProvider: FactoryProvider<ActiveMemberships> = {
  provide: ACTIVE_MEMBERSHIPS,
  inject: [FindActiveMembership, FindUserMemberships],
  useFactory: (
    findActiveMembership: FindActiveMembership,
    findUserMemberships: FindUserMemberships,
  ): ActiveMemberships => ({
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
    listOfUser: async (userId: string): Promise<readonly UserMembership[]> => {
      const found: FindUserMembershipsOutput = await findUserMemberships.execute({ userId });
      return found.memberships.map(
        (membership: {
          readonly organizationId: string;
          readonly role: UserMembership['role'];
        }) => ({
          organizationId: membership.organizationId,
          role: membership.role,
        }),
      );
    },
  }),
};
