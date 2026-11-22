import type { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import { AuthenticationPolicyRefusal } from '../../../../models/authentication-policy/authentication-policy-refusal.model.js';
import type { CheckedAuthentication } from '../../../../models/session/checked-authentication.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { OrganizationMembers } from '../../../../ports/outbound/memberships/authentication-policy/organization-members.port.js';
import type { ActiveMemberships } from '../../../../ports/outbound/memberships/session/active-memberships.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { AuthenticationPolicyView } from '../../../../projections/authentication-policy/authentication-policy-view.projection.js';
import {
  assertPolicyEditor,
  toAuthenticationPolicyView,
} from '../../../../services/authentication-policy/authentication-policy-view.service.js';
import { checkSessionAuthentication } from '../../../../services/session/session-authentication.service.js';
import type { UpdateAuthenticationPolicyInput } from './update-authentication-policy.input.js';

/**
 * Class UpdateAuthenticationPolicy
 *
 * @description
 * Applies a JSON Merge Patch to the authentication policy of the organization of the internal token
 * (`PATCH /internal/v1/organization/authentication-policy`, decision 8 of P2c), in its tenant
 * transaction. The checks run in the order of the contract:
 *
 * 1. the current role of the actor in Organization (`organization.not-found`,
 * `organization.role-forbidden`);
 * 2. `If-Match` against the locked policy (`request.version-mismatch`);
 * 3. a policy that would require two-step verification for the role of the actor, who has none
 * (`auth.two-step-not-enabled`): nobody locks themselves out of their own organization;
 * 4. the recent authentication of the session of the request, open, of the actor, acting on this
 * organization, which it locks (`auth.reauthentication-required`, `session.not-found`).
 *
 * A patch that moves nothing answers the same version and changes nothing, but the lock of a
 * policy an organization never patched inserts its default row first. From the next
 * introspection, the sessions and tokens acting on the organization follow the new policy. Emits
 * nothing (the contract declares no event).
 */
export class UpdateAuthenticationPolicy {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The tenant transaction of the organization of the internal token.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property members
   *
   * @description
   * The copy of the memberships, in that transaction.
   *
   * @type {OrganizationMembers}
   * @readonly
   */
  private readonly members: OrganizationMembers;

  /**
   * Property clock
   *
   * @description
   * The time of the change.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;

  /** The authoritative membership reader, called outside the tenant transaction. */
  private readonly authority: Pick<ActiveMemberships, 'find'> | null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes its ports, bound by the composition of the module.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The tenant transaction of the organization of the internal token.
   * @param {OrganizationMembers} members - The copy of the memberships, in that transaction.
   * @param {Clock} clock - The time of the change.
   * @constructor
   */
  public constructor(
    unitOfWork: SessionsUnitOfWork,
    members: OrganizationMembers,
    clock: Clock,
    authority: Pick<ActiveMemberships, 'find'> | null,
  ) {
    this.unitOfWork = unitOfWork;
    this.members = members;
    this.clock = clock;
    this.authority = authority;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Changes the policy for its owner or one of its admins.
   *
   * @param {UpdateAuthenticationPolicyInput} input - The actor, the organization, the session, `If-Match` and the patch.
   * @returns {Promise<AuthenticationPolicyView>} The policy after the change, and its counts.
   * @throws {AuthenticationPolicyRefusal} For a refusal of the contract; nothing is written.
   */
  public async execute(input: UpdateAuthenticationPolicyInput): Promise<AuthenticationPolicyView> {
    if (this.authority === null) {
      throw new Error(
        'Organization membership authority is required to update authentication policy.',
      );
    }
    const membership = await this.authority.find(input.organizationId, input.actorUserId);
    const role: 'owner' | 'admin' = assertPolicyEditor(membership?.role ?? null);
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: SessionsStore): Promise<AuthenticationPolicyView> => {
      const current: AuthenticationPolicy = await store.policies.lock(input.organizationId);
      if (
        input.expectedVersions !== null &&
        !input.expectedVersions.includes(current.snapshot.version)
      ) {
        throw new AuthenticationPolicyRefusal('version-mismatch', {
          version: current.snapshot.version,
        });
      }
      const next: AuthenticationPolicy = current.apply({
        ...(input.twoStepVerificationRequiredFor === undefined
          ? {}
          : { twoStepVerificationRequiredFor: input.twoStepVerificationRequiredFor }),
        ...(input.sessionInactivityTimeoutMinutes === undefined
          ? {}
          : { sessionInactivityTimeoutMinutes: input.sessionInactivityTimeoutMinutes }),
      });
      if (next.withholds(role, await store.enrollments.isEnrolled(input.actorUserId))) {
        throw new AuthenticationPolicyRefusal('two-step-not-enabled');
      }
      const checked: CheckedAuthentication = await checkSessionAuthentication(
        store,
        input.actorUserId,
        input.sessionId,
        now,
        true,
      );
      if (checked.status === 'not-found') {
        throw new AuthenticationPolicyRefusal('session-not-found');
      }
      if (checked.status === 'stale') {
        throw new AuthenticationPolicyRefusal('reauthentication-required', {
          twoStepVerificationEnabled: checked.twoStepVerificationEnabled,
        });
      }
      if (next !== current) {
        await store.policies.save(next);
      }
      return toAuthenticationPolicyView(store, this.members, next);
    });
  }
  // #endregion
}
