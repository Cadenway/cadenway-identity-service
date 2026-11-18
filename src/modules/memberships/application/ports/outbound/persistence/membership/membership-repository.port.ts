import type { Membership } from '../../../../../domain/aggregates/membership/membership.aggregate.js';

/**
 * Interface MembershipRepository
 *
 * @description
 * The copy of the memberships, bound to the transaction of a unit of work. In a tenant transaction
 * (the handler of a member event) row-level security limits it to the organization of the event; in
 * a system transaction (the introspections, the choice of an organization) every read names the
 * organization and the account explicitly.
 */
export interface MembershipRepository {
  // #region Methods
  /**
   * Method lock
   *
   * @description
   * Loads a membership by its organization and its id and locks it until the end of the
   * transaction.
   *
   * @param {string} organizationId - The organization of the event.
   * @param {string} id - The `memberId`.
   * @returns {Promise<Membership | null>} The membership, or `null` when this service has not seen it.
   */
  lock(organizationId: string, id: string): Promise<Membership | null>;

  /**
   * Method insertIfAbsent
   *
   * @description
   * Stores a membership seen for the first time, unless a concurrent transaction stored it first.
   *
   * @param {Membership} membership - The new copy.
   * @returns {Promise<boolean>} Whether it was inserted; `false` when the id already exists.
   */
  insertIfAbsent(membership: Membership): Promise<boolean>;

  /**
   * Method update
   *
   * @description
   * Writes the role, the version and the removal of a membership locked by `lock`.
   *
   * @param {Membership} membership - The membership after the change.
   * @returns {Promise<void>} Resolves once written.
   */
  update(membership: Membership): Promise<void>;

  /**
   * Method findActive
   *
   * @description
   * The active membership of an account in an organization: the most recent one should two be
   * active for the few seconds a removal and a new join cross.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The account.
   * @returns {Promise<Membership | null>} The membership, or `null` when the account is not a member.
   */
  findActive(organizationId: string, userId: string): Promise<Membership | null>;

  /**
   * Method findOwnedOrganizationIds
   *
   * @description
   * The organizations whose active membership of an account has the role `owner`.
   *
   * @param {string} userId - The account.
   * @returns {Promise<string[]>} Their ids.
   */
  findOwnedOrganizationIds(userId: string): Promise<string[]>;

  /**
   * Method findActiveOfUser
   *
   * @description
   * The active memberships of an account, one per organization (the latest when the copy holds
   * several), across organizations.
   *
   * @param {string} userId - The account.
   * @returns {Promise<Membership[]>} Its memberships, by organization id.
   */
  findActiveOfUser(userId: string): Promise<Membership[]>;

  /**
   * Method listActiveOfOrganization
   *
   * @description
   * The active memberships of an organization, one per account (the latest when the copy holds
   * several).
   *
   * @param {string} organizationId - The organization.
   * @returns {Promise<Membership[]>} Its memberships, by account id.
   */
  listActiveOfOrganization(organizationId: string): Promise<Membership[]>;
  // #endregion
}
