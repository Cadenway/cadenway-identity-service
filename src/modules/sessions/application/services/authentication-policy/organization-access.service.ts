import type { SessionsStore } from '../../models/session/sessions-store.model.js';

/**
 * Function isOrganizationWithheld
 *
 * @description
 * Whether the authentication policy of an organization withholds it from a member ("Withheld
 * organization" of the internal contract, decision 8 of P2c): the policy requires two-step
 * verification for the role of the member, whose account has none. The rule belongs to
 * `AuthenticationPolicy.withholds`; this reads the policy and the enrollment of the account in the
 * transaction of the caller, both by key.
 *
 * @param {SessionsStore} store - The repositories of the transaction.
 * @param {string} organizationId - The organization.
 * @param {string} userId - The account of the member.
 * @param {'owner' | 'admin' | 'member' | 'guest'} role - The role of the member in the copy of the
 * memberships.
 * @returns {Promise<boolean>} `true` when the organization is withheld.
 */
export async function isOrganizationWithheld(
  store: SessionsStore,
  organizationId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member' | 'guest',
): Promise<boolean> {
  return (await store.policies.find(organizationId)).withholds(
    role,
    await store.enrollments.isEnrolled(userId),
  );
}
