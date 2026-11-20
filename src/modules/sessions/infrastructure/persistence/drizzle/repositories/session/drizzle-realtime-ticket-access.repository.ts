import type { SystemTransactionRunner } from '@cadenway/nest-common/database';

import type { RealtimeTicketAccess } from '../../../../../application/models/realtime-ticket/realtime-ticket-access.model.js';
import type { ActiveMembership } from '../../../../../application/models/session/active-membership.model.js';
import type { RealtimeTicketAccessPort } from '../../../../../application/ports/outbound/memberships/realtime-ticket/realtime-ticket-access.port.js';
import { DrizzleAuthenticationPolicyRepository } from '../authentication-policy/drizzle-authentication-policy.repository.js';
import { DrizzleTwoStepEnrollmentRepository } from './drizzle-two-step-enrollment.repository.js';

interface LockedMembershipLookup {
  // #region Methods
  /** Locks the active membership in the caller's system transaction. */
  execute(input: {
    readonly organizationId: string;
    readonly userId: string;
  }): Promise<ActiveMembership | null>;
  // #endregion
}

/** Resolves and locks the policy, membership and any required two-step enrollment. */
export class DrizzleRealtimeTicketAccessRepository implements RealtimeTicketAccessPort {
  // #region Constructor
  /** Joins the ticket transaction and calls the public membership boundary in that transaction. */
  public constructor(
    private readonly runner: SystemTransactionRunner,
    private readonly memberships: LockedMembershipLookup,
  ) {}
  // #endregion

  // #region Methods
  /** Holds the authorization state until the ticket transaction commits. */
  public resolveForUpdate(organizationId: string, userId: string): Promise<RealtimeTicketAccess> {
    return this.runner.run(async ({ db }) => {
      const policy = await new DrizzleAuthenticationPolicyRepository(db).lock(organizationId);
      const membership = await this.memberships.execute({ organizationId, userId });
      if (membership === null) return { status: 'unavailable' };
      if (policy.requiresTwoStepFor(membership.role)) {
        const enrolled = await new DrizzleTwoStepEnrollmentRepository(db).isEnrolledForUpdate(
          userId,
        );
        if (policy.withholds(membership.role, enrolled)) return { status: 'mfa-required' };
      }
      return { status: 'allowed', membership };
    });
  }
  // #endregion
}
