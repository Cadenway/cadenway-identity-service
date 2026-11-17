import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { PasswordResetLinkRepository } from '../../../../../application/ports/outbound/persistence/accounts/password-reset-link-repository.port.js';
import type { PasswordResetLinkIssue } from '../../../../../domain/aggregates/password-reset/password-reset-link-issue.aggregate.js';
import type { PasswordResetLink } from '../../../../../domain/aggregates/password-reset/password-reset-link.aggregate.js';
import { toPasswordResetLink } from '../../mappers/password-reset/password-reset-link.mapper.js';
import type { PasswordResetLinkRow } from '../../mappers/password-reset/password-reset-link.mapper.js';
import passwordResetLinks from '../../schemas/password-reset/password-reset-link.schema.js';

/**
 * Class DrizzlePasswordResetLinkRepository
 *
 * @description
 * `PasswordResetLinkRepository` on `password_reset_links`, in the transaction of its unit of work.
 * A link is found by the unique hash of its token, or by its account through the partial unique
 * index of the current link.
 */
export class DrizzlePasswordResetLinkRepository implements PasswordResetLinkRepository {
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
   * Method findByTokenHash
   *
   * @description
   * Reads the link of a token hash.
   *
   * @param {string} tokenHash - SHA-256 of the token.
   * @param {boolean} forUpdate - Whether to lock the row.
   * @returns {Promise<PasswordResetLink | null>} The link, or `null`.
   */
  public async findByTokenHash(
    tokenHash: string,
    forUpdate: boolean,
  ): Promise<PasswordResetLink | null> {
    const query = this.db
      .select()
      .from(passwordResetLinks)
      .where(eq(passwordResetLinks.tokenHash, tokenHash))
      .limit(1);
    const rows: PasswordResetLinkRow[] = forUpdate ? await query.for('update') : await query;
    const row: PasswordResetLinkRow | undefined = rows[0];
    return row === undefined ? null : toPasswordResetLink(row);
  }

  /**
   * Method replaceCurrent
   *
   * @description
   * Marks the current link of the account replaced.
   *
   * @param {string} userId - The account.
   * @param {Date} now - When it was replaced.
   * @returns {Promise<void>} Resolves once written.
   */
  public async replaceCurrent(userId: string, now: Date): Promise<void> {
    await this.db
      .update(passwordResetLinks)
      .set({ replacedAt: now, updatedAt: sql`now()` })
      .where(
        and(
          eq(passwordResetLinks.userId, userId),
          isNull(passwordResetLinks.usedAt),
          isNull(passwordResetLinks.replacedAt),
        ),
      );
  }

  /**
   * Method insert
   *
   * @description
   * Stores a new link; PostgreSQL assigns its id.
   *
   * @param {PasswordResetLinkIssue} issue - The link.
   * @returns {Promise<PasswordResetLink>} The stored link.
   */
  public async insert(issue: PasswordResetLinkIssue): Promise<PasswordResetLink> {
    const rows: PasswordResetLinkRow[] = await this.db
      .insert(passwordResetLinks)
      .values({ userId: issue.userId, tokenHash: issue.tokenHash, expiresAt: issue.expiresAt })
      .returning();
    const row: PasswordResetLinkRow | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The insert of a password reset link returned no row.');
    }
    return toPasswordResetLink(row);
  }

  /**
   * Method save
   *
   * @description
   * Writes the use of a link.
   *
   * @param {PasswordResetLink} link - The used link.
   * @returns {Promise<void>} Resolves once written.
   */
  public async save(link: PasswordResetLink): Promise<void> {
    await this.db
      .update(passwordResetLinks)
      .set({ usedAt: link.snapshot.usedAt, updatedAt: sql`now()` })
      .where(eq(passwordResetLinks.id, link.id));
  }
  // #endregion
}
