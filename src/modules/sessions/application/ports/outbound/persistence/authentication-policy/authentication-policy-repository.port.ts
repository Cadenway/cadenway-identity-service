import type { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';

/**
 * Interface AuthenticationPolicyRepository
 *
 * @description
 * The authentication policies of the organizations (`authentication_policies`), read by
 * organization. An organization without a row has the default policy.
 */
export interface AuthenticationPolicyRepository {
  // #region Methods
  /**
   * Method find
   *
   * @description
   * The policy of an organization.
   *
   * @param {string} organizationId - The organization.
   * @returns {Promise<AuthenticationPolicy>} Its policy, the default one without a row.
   */
  find(organizationId: string): Promise<AuthenticationPolicy>;

  /**
   * Method findMany
   *
   * @description
   * The policies of several organizations, one query.
   *
   * @param {readonly string[]} organizationIds - The organizations.
   * @returns {Promise<AuthenticationPolicy[]>} Their policies, the default one for those without a
   * row, in the order of the ids.
   */
  findMany(organizationIds: readonly string[]): Promise<AuthenticationPolicy[]>;

  /**
   * Method lock
   *
   * @description
   * Locks the policy of an organization for a change, storing the default policy first when it has
   * none, so that two changes of a default policy wait for each other.
   *
   * @param {string} organizationId - The organization.
   * @returns {Promise<AuthenticationPolicy>} The locked policy.
   */
  lock(organizationId: string): Promise<AuthenticationPolicy>;

  /**
   * Method save
   *
   * @description
   * Stores a changed policy, whose previous version is the locked one.
   *
   * @param {AuthenticationPolicy} policy - The policy after the change.
   * @returns {Promise<void>} Resolves once written.
   */
  save(policy: AuthenticationPolicy): Promise<void>;
  // #endregion
}
