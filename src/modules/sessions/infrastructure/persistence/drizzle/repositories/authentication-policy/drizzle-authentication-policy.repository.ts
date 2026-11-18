import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type { AuthenticationPolicyRepository } from '../../../../../application/ports/outbound/persistence/authentication-policy/authentication-policy-repository.port.js';
import { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import { toAuthenticationPolicy } from '../../mappers/authentication-policy/authentication-policy.mapper.js';
import policies from '../../schemas/authentication-policy/authentication-policy.schema.js';

/**
 * Class DrizzleAuthenticationPolicyRepository
 *
 * @description
 * `AuthenticationPolicyRepository` on `authentication_policies`, in the transaction of its unit of
 * work: system transactions for the introspections, the choice of an organization and the
 * requirements of an account, the tenant one of the policy routes. Every query names its
 * organizations by primary key.
 */
export class DrizzleAuthenticationPolicyRepository implements AuthenticationPolicyRepository {
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
   * Method find
   *
   * @description
   * Reads the policy of an organization, the default one without a row.
   *
   * @param {string} organizationId - The organization.
   * @returns {Promise<AuthenticationPolicy>} The policy.
   */
  public async find(organizationId: string): Promise<AuthenticationPolicy> {
    const rows: (typeof policies.$inferSelect)[] = await this.db
      .select()
      .from(policies)
      .where(eq(policies.organizationId, organizationId))
      .limit(1);
    const row: typeof policies.$inferSelect | undefined = rows[0];
    return row === undefined
      ? AuthenticationPolicy.defaultFor(organizationId)
      : toAuthenticationPolicy(row);
  }

  /**
   * Method findMany
   *
   * @description
   * Reads the policies of several organizations in one query.
   *
   * @param {readonly string[]} organizationIds - The organizations.
   * @returns {Promise<AuthenticationPolicy[]>} Their policies, in the order of the ids.
   */
  public async findMany(organizationIds: readonly string[]): Promise<AuthenticationPolicy[]> {
    if (organizationIds.length === 0) {
      return [];
    }
    const rows: (typeof policies.$inferSelect)[] = await this.db
      .select()
      .from(policies)
      .where(inArray(policies.organizationId, [...organizationIds]));
    const stored = new Map<string, AuthenticationPolicy>(
      rows.map((row: typeof policies.$inferSelect): [string, AuthenticationPolicy] => [
        row.organizationId,
        toAuthenticationPolicy(row),
      ]),
    );
    return organizationIds.map(
      (organizationId: string): AuthenticationPolicy =>
        stored.get(organizationId) ?? AuthenticationPolicy.defaultFor(organizationId),
    );
  }

  /**
   * Method lock
   *
   * @description
   * Stores the default policy when the organization has none (`on conflict do nothing`), then
   * locks the row, so that concurrent changes wait for each other instead of inserting twice.
   *
   * @param {string} organizationId - The organization.
   * @returns {Promise<AuthenticationPolicy>} The locked policy.
   * @throws {Error} When the row cannot be read back, which the insert rules out.
   */
  public async lock(organizationId: string): Promise<AuthenticationPolicy> {
    await this.db.insert(policies).values({ organizationId }).onConflictDoNothing();
    const rows: (typeof policies.$inferSelect)[] = await this.db
      .select()
      .from(policies)
      .where(eq(policies.organizationId, organizationId))
      .for('update');
    const row: typeof policies.$inferSelect | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The policy of the organization was not stored.');
    }
    return toAuthenticationPolicy(row);
  }

  /**
   * Method save
   *
   * @description
   * Writes a changed policy over the locked one, the previous version.
   *
   * @param {AuthenticationPolicy} policy - The policy after the change.
   * @returns {Promise<void>} Resolves once written.
   * @throws {Error} When the stored version is not the previous one.
   */
  public async save(policy: AuthenticationPolicy): Promise<void> {
    const updated: { organizationId: string }[] = await this.db
      .update(policies)
      .set({
        twoStepVerificationRequiredFor: policy.snapshot.twoStepVerificationRequiredFor,
        sessionInactivityTimeoutMinutes: policy.snapshot.sessionInactivityTimeoutMinutes,
        version: policy.snapshot.version,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(policies.organizationId, policy.snapshot.organizationId),
          eq(policies.version, policy.snapshot.version - 1),
        ),
      )
      .returning({ organizationId: policies.organizationId });
    if (updated.length !== 1) {
      throw new Error('The policy changed since it was locked.');
    }
  }
  // #endregion
}
