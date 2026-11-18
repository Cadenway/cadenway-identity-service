import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { eq, sql } from 'drizzle-orm';

import type { SignInChallengeRepository } from '../../../../../application/ports/outbound/persistence/two-step/sign-in-challenge-repository.port.js';
import type { SignInChallengeIssue } from '../../../../../domain/aggregates/two-step/sign-in-challenge-issue.aggregate.js';
import { SignInChallenge } from '../../../../../domain/aggregates/two-step/sign-in-challenge.aggregate.js';
import challenges from '../../schemas/two-step/sign-in-challenge.schema.js';

/**
 * Function toSignInChallenge
 *
 * @description
 * Maps a row of `sign_in_challenges` to its challenge.
 *
 * @param {typeof challenges.$inferSelect} row - The row.
 * @returns {SignInChallenge} The challenge.
 */
function toSignInChallenge(row: typeof challenges.$inferSelect): SignInChallenge {
  return SignInChallenge.restore({
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    persistent: row.persistent,
    expiresAt: row.expiresAt,
    assertionChallenge: row.assertionChallenge,
    assertionExpiresAt: row.assertionExpiresAt,
  });
}

/**
 * Class DrizzleSignInChallengeRepository
 *
 * @description
 * `SignInChallengeRepository` on `sign_in_challenges`: one row per account (unique `user_id`), a
 * challenge read by the unique hash of its token.
 */
export class DrizzleSignInChallengeRepository implements SignInChallengeRepository {
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
   * Method replace
   *
   * @description
   * Stores the new challenge of the account over the previous one, with a new id, so the token of
   * the previous one no longer finds it.
   *
   * @param {SignInChallengeIssue} issue - The new challenge.
   * @returns {Promise<SignInChallenge>} The stored challenge.
   * @throws {Error} When PostgreSQL returns no row.
   */
  public async replace(issue: SignInChallengeIssue): Promise<SignInChallenge> {
    const rows: (typeof challenges.$inferSelect)[] = await this.db
      .insert(challenges)
      .values({
        userId: issue.userId,
        tokenHash: issue.tokenHash,
        persistent: issue.persistent,
        expiresAt: issue.expiresAt,
      })
      .onConflictDoUpdate({
        target: challenges.userId,
        set: {
          id: sql`uuidv7()`,
          tokenHash: issue.tokenHash,
          persistent: issue.persistent,
          expiresAt: issue.expiresAt,
          assertionChallenge: null,
          assertionExpiresAt: null,
          createdAt: sql`now()`,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    const row: typeof challenges.$inferSelect | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The insert of a challenge returned no row.');
    }
    return toSignInChallenge(row);
  }

  /**
   * Method findByTokenHash
   *
   * @description
   * A challenge by the hash of its token, locked when asked.
   *
   * @param {string} tokenHash - The SHA-256 of the token.
   * @param {boolean} forUpdate - Whether to lock it.
   * @returns {Promise<SignInChallenge | null>} The challenge, or `null`.
   */
  public async findByTokenHash(
    tokenHash: string,
    forUpdate: boolean,
  ): Promise<SignInChallenge | null> {
    const query = this.db
      .select()
      .from(challenges)
      .where(eq(challenges.tokenHash, tokenHash))
      .limit(1);
    const rows: (typeof challenges.$inferSelect)[] = forUpdate
      ? await query.for('update')
      : await query;
    const row: typeof challenges.$inferSelect | undefined = rows[0];
    return row === undefined ? null : toSignInChallenge(row);
  }

  /**
   * Method saveAssertion
   *
   * @description
   * Writes the WebAuthn challenge of the latest security-key options of a challenge.
   *
   * @param {SignInChallenge} challenge - The challenge with its options.
   * @returns {Promise<void>} Resolves once written.
   */
  public async saveAssertion(challenge: SignInChallenge): Promise<void> {
    await this.db
      .update(challenges)
      .set({
        assertionChallenge: challenge.snapshot.assertionChallenge,
        assertionExpiresAt: challenge.snapshot.assertionExpiresAt,
        updatedAt: sql`now()`,
      })
      .where(eq(challenges.id, challenge.id));
  }

  /**
   * Method deleteOfUser
   *
   * @description
   * Deletes the open challenge of the account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async deleteOfUser(userId: string): Promise<void> {
    await this.db.delete(challenges).where(eq(challenges.userId, userId));
  }
  // #endregion
}
