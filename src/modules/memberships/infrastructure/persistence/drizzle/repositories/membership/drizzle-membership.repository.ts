import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { MembershipRepository } from '../../../../../application/ports/outbound/persistence/membership/membership-repository.port.js';
import type { Membership } from '../../../../../domain/aggregates/membership/membership.aggregate.js';
import { toMembership } from '../../mappers/membership/membership.mapper.js';
import type { MembershipRow } from '../../mappers/membership/membership.mapper.js';
import memberships from '../../schemas/membership/membership.schema.js';

/**
 * Class DrizzleMembershipRepository
 *
 * @description
 * `MembershipRepository` on the `memberships` table, in the transaction of its unit of work. Every
 * query names the organization: the reads by id serve the handler, in the tenant transaction of the
 * event, where row-level security also hides any other organization; the read of an active
 * membership names the organization and the account, both indexed. A membership id of another
 * organization is invisible to the handler: its insert does nothing, on the primary key.
 */
export class DrizzleMembershipRepository implements MembershipRepository {
  // #region Properties
  /**
   * Property db
   *
   * @description
   * The Drizzle database of the transaction.
   *
   * @type {TransactionDatabase}
   * @readonly
   */
  private readonly db: TransactionDatabase;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the repository to a transaction.
   *
   * @param {TransactionDatabase} db - The Drizzle database of the transaction.
   * @constructor
   */
  public constructor(db: TransactionDatabase) {
    this.db = db;
  }
  // #endregion

  // #region Methods
  /**
   * Method lock
   *
   * @description
   * Loads and locks a membership by its organization and its id.
   *
   * @param {string} organizationId - The organization of the event.
   * @param {string} id - The `memberId`.
   * @returns {Promise<Membership | null>} The membership, or `null`.
   */
  public async lock(organizationId: string, id: string): Promise<Membership | null> {
    const rows: MembershipRow[] = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, id)))
      .limit(1)
      .for('update');
    const row: MembershipRow | undefined = rows[0];
    return row === undefined ? null : toMembership(row);
  }

  /**
   * Method insertIfAbsent
   *
   * @description
   * Inserts a membership, or nothing when its id exists: a concurrent insert of the same id waits
   * for the other transaction, then inserts nothing.
   *
   * @param {Membership} membership - The new copy.
   * @returns {Promise<boolean>} Whether it was inserted.
   */
  public async insertIfAbsent(membership: Membership): Promise<boolean> {
    const { id, organizationId, userId, role, version, removedAt } = membership.snapshot;
    const inserted: { id: string }[] = await this.db
      .insert(memberships)
      .values({ id, organizationId, userId, role, version, removedAt })
      .onConflictDoNothing({ target: memberships.id })
      .returning({ id: memberships.id });
    return inserted.length === 1;
  }

  /**
   * Method update
   *
   * @description
   * Writes the role, the version and the removal of a locked membership.
   *
   * @param {Membership} membership - The membership after the change.
   * @returns {Promise<void>} Resolves once written.
   * @throws {Error} When the row is gone, which a lock prevents.
   */
  public async update(membership: Membership): Promise<void> {
    const { id, organizationId, role, version, removedAt } = membership.snapshot;
    const updated: { id: string }[] = await this.db
      .update(memberships)
      .set({ role, version, removedAt, updatedAt: sql`now()` })
      .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, id)))
      .returning({ id: memberships.id });
    if (updated.length !== 1) {
      throw new Error('The membership vanished while it was locked.');
    }
  }

  /**
   * Method findActive
   *
   * @description
   * Loads the most recent active membership of an account in an organization.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The account.
   * @returns {Promise<Membership | null>} The membership, or `null`.
   */
  public async findActive(organizationId: string, userId: string): Promise<Membership | null> {
    const rows: MembershipRow[] = await this.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.userId, userId),
          isNull(memberships.removedAt),
        ),
      )
      .orderBy(desc(memberships.createdAt), desc(memberships.id))
      .limit(1);
    const row: MembershipRow | undefined = rows[0];
    return row === undefined ? null : toMembership(row);
  }

  /**
   * Method findOwnedOrganizationIds
   *
   * @description
   * Reads the organizations an account owns, through the index on `user_id`, in a system
   * transaction: the one read of the copy by account across organizations.
   *
   * @param {string} userId - The account.
   * @returns {Promise<string[]>} Their ids, in order.
   */
  public async findOwnedOrganizationIds(userId: string): Promise<string[]> {
    const rows: { organizationId: string }[] = await this.db
      .selectDistinct({ organizationId: memberships.organizationId })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.role, 'owner'),
          isNull(memberships.removedAt),
        ),
      )
      .orderBy(memberships.organizationId);
    return rows.map((row: { organizationId: string }) => row.organizationId);
  }

  /**
   * Method findActiveOfUser
   *
   * @description
   * Reads the active memberships of an account through the index on `user_id`, one per
   * organization (`distinct on` the organization, the latest first), in a system transaction: the
   * requirements of two-step verification of the account read its roles across organizations.
   *
   * @param {string} userId - The account.
   * @returns {Promise<Membership[]>} Its memberships, by organization id.
   */
  public async findActiveOfUser(userId: string): Promise<Membership[]> {
    const rows: MembershipRow[] = await this.db
      .selectDistinctOn([memberships.organizationId])
      .from(memberships)
      .where(and(eq(memberships.userId, userId), isNull(memberships.removedAt)))
      .orderBy(memberships.organizationId, desc(memberships.createdAt), desc(memberships.id));
    return rows.map(toMembership);
  }

  /**
   * Method listActiveOfOrganization
   *
   * @description
   * Reads the active memberships of an organization through the index on
   * `(organization_id, user_id)`, one per account (`distinct on` the account, the latest first), in
   * the tenant transaction of that organization. The work grows with the members of the
   * organization: the policy routes count its members without two-step verification from it.
   *
   * @param {string} organizationId - The organization.
   * @returns {Promise<Membership[]>} Its memberships, by account id.
   */
  public async listActiveOfOrganization(organizationId: string): Promise<Membership[]> {
    const rows: MembershipRow[] = await this.db
      .selectDistinctOn([memberships.userId])
      .from(memberships)
      .where(and(eq(memberships.organizationId, organizationId), isNull(memberships.removedAt)))
      .orderBy(memberships.userId, desc(memberships.createdAt), desc(memberships.id));
    return rows.map(toMembership);
  }
  // #endregion
}
