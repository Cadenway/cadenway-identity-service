import type { AuthenticationPolicy } from '../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import { AuthenticationPolicyRefusal } from '../../models/authentication-policy/authentication-policy-refusal.model.js';
import type { OrganizationMember } from '../../models/authentication-policy/organization-member.model.js';
import type { SessionsStore } from '../../models/session/sessions-store.model.js';
import type { OrganizationMembers } from '../../ports/outbound/memberships/authentication-policy/organization-members.port.js';
import type { AuthenticationPolicyView } from '../../projections/authentication-policy/authentication-policy-view.projection.js';

/**
 * Function assertPolicyEditor
 *
 * @description
 * Only the owner and the admins of the organization, in the copy of the memberships, read and
 * change its policy (decision 8 of P2c): an account the copy does not hold as a member is refused
 * as `organization.not-found`, a member or a guest as `organization.role-forbidden`.
 *
 * @param {'owner' | 'admin' | 'member' | 'guest' | null} role - The role of the actor there.
 * @returns {'owner' | 'admin'} The role of the actor, an editor.
 * @throws {AuthenticationPolicyRefusal} `organization-not-found` or `role-forbidden`.
 */
export function assertPolicyEditor(
  role: 'owner' | 'admin' | 'member' | 'guest' | null,
): 'owner' | 'admin' {
  if (role === null) {
    throw new AuthenticationPolicyRefusal('organization-not-found');
  }
  if (role !== 'owner' && role !== 'admin') {
    throw new AuthenticationPolicyRefusal('role-forbidden');
  }
  return role;
}

/**
 * Function toAuthenticationPolicyView
 *
 * @description
 * The policy as its routes answer it, with its members whose account has no two-step verification
 * ("7 personnes ne l’ont pas configurée"): every active member of the organization is read, then
 * the accounts with two-step verification among them in one query, so the work grows with the
 * members of the organization; it serves the policy screen only.
 *
 * @param {SessionsStore} store - The repositories of the tenant transaction.
 * @param {OrganizationMembers} members - The copy of the memberships.
 * @param {AuthenticationPolicy} policy - The policy.
 * @returns {Promise<AuthenticationPolicyView>} The answer.
 */
export async function toAuthenticationPolicyView(
  store: SessionsStore,
  members: OrganizationMembers,
  policy: AuthenticationPolicy,
): Promise<AuthenticationPolicyView> {
  const listed: readonly OrganizationMember[] = await members.list(policy.snapshot.organizationId);
  const enrolled: ReadonlySet<string> = await store.enrollments.enrolledAmong(
    listed.map((member: OrganizationMember): string => member.userId),
  );
  const without: readonly OrganizationMember[] = listed.filter(
    (member: OrganizationMember): boolean => !enrolled.has(member.userId),
  );
  return {
    twoStepVerificationRequiredFor: policy.snapshot.twoStepVerificationRequiredFor,
    sessionInactivityTimeoutMinutes: policy.snapshot.sessionInactivityTimeoutMinutes,
    adminsWithoutTwoStepVerification: without.filter(
      (member: OrganizationMember): boolean => member.role === 'owner' || member.role === 'admin',
    ).length,
    membersWithoutTwoStepVerification: without.length,
    version: policy.snapshot.version,
  };
}
