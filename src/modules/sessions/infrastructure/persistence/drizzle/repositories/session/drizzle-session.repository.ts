import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, eq, lt, sql } from 'drizzle-orm';

import type { SessionOrigin } from '../../../../../application/models/session/session-origin.model.js';
import type { SessionRepository } from '../../../../../application/ports/outbound/persistence/session/session-repository.port.js';
import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type { SessionStart } from '../../../../../domain/value-objects/session/session-start.value-object.js';
import { toSession } from '../../mappers/session/session.mapper.js';
import type { SessionRow } from '../../mappers/session/session.mapper.js';
import sessions from '../../schemas/session/session.schema.js';

/**
 * Class DrizzleSessionRepository
 *
 * @description
 * `SessionRepository` on the `sessions` table, in the transaction of its unit of work. Every read
 * names the session by its id or by the unique hash of its token.
 */
export class DrizzleSessionRepository implements SessionRepository {
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
   * Method insert
   *
   * @description
   * Inserts a new session and reads back the id PostgreSQL assigned.
   *
   * @param {SessionStart} start - The session to store.
   * @param {SessionOrigin} origin - Its token hash and its browser.
   * @returns {Promise<Session>} The stored session.
   * @throws {Error} When PostgreSQL returns no row, which never happens for a successful insert.
   */
  public async insert(start: SessionStart, origin: SessionOrigin): Promise<Session> {
    const rows: SessionRow[] = await this.db
      .insert(sessions)
      .values({
        userId: start.userId,
        tokenHash: origin.tokenHash,
        persistent: start.persistent,
        ipAddress: origin.ipAddress,
        userAgent: origin.userAgent,
        browser: origin.device.browser,
        operatingSystem: origin.device.operatingSystem,
        deviceType: origin.device.deviceType,
        organizationId: start.organizationId,
        memberId: start.memberId,
        lastActiveAt: start.lastActiveAt,
        expiresAt: start.expiresAt,
        version: start.version,
      })
      .returning();
    const row: SessionRow | undefined = rows[0];
    if (row === undefined) {
      throw new Error('The insert of a session returned no row.');
    }
    return toSession(row);
  }

  /**
   * Method findByTokenHash
   *
   * @description
   * Loads the session of a token hash.
   *
   * @param {string} tokenHash - SHA-256 of the presented token.
   * @returns {Promise<Session | null>} The session, or `null`.
   */
  public async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const rows: SessionRow[] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    const row: SessionRow | undefined = rows[0];
    return row === undefined ? null : toSession(row);
  }

  /**
   * Method findForUpdate
   *
   * @description
   * Loads and locks a session by its id.
   *
   * @param {string} id - Id of the session.
   * @returns {Promise<Session | null>} The session, or `null`.
   */
  public async findForUpdate(id: string): Promise<Session | null> {
    const rows: SessionRow[] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1)
      .for('update');
    const row: SessionRow | undefined = rows[0];
    return row === undefined ? null : toSession(row);
  }

  /**
   * Method recordActivity
   *
   * @description
   * Moves the last activity forward; a concurrent introspection that wrote a later one wins.
   *
   * @param {Session} session - The session after the activity.
   * @returns {Promise<void>} Resolves once written.
   */
  public async recordActivity(session: Session): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastActiveAt: session.snapshot.lastActiveAt })
      .where(
        and(eq(sessions.id, session.id), lt(sessions.lastActiveAt, session.snapshot.lastActiveAt)),
      );
  }

  /**
   * Method chooseOrganization
   *
   * @description
   * Writes the current organization, its membership and the version of a session locked by
   * `findForUpdate`.
   *
   * @param {Session} session - The session after the choice.
   * @returns {Promise<void>} Resolves once written.
   * @throws {Error} When no row has the previous version.
   */
  public async chooseOrganization(session: Session): Promise<void> {
    const updated: { id: string }[] = await this.db
      .update(sessions)
      .set({
        organizationId: session.snapshot.organizationId,
        memberId: session.snapshot.memberId,
        version: session.snapshot.version,
        updatedAt: sql`now()`,
      })
      .where(and(eq(sessions.id, session.id), eq(sessions.version, session.snapshot.version - 1)))
      .returning({ id: sessions.id });
    if (updated.length !== 1) {
      throw new Error('The session changed since it was loaded.');
    }
  }

  /**
   * Method revoke
   *
   * @description
   * Writes the revocation and the version of a session locked by `findForUpdate`.
   *
   * @param {Session} session - The revoked session.
   * @returns {Promise<void>} Resolves once written.
   * @throws {Error} When no row has the previous version.
   */
  public async revoke(session: Session): Promise<void> {
    const updated: { id: string }[] = await this.db
      .update(sessions)
      .set({
        revokedAt: session.snapshot.revokedAt,
        version: session.snapshot.version,
        updatedAt: sql`now()`,
      })
      .where(and(eq(sessions.id, session.id), eq(sessions.version, session.snapshot.version - 1)))
      .returning({ id: sessions.id });
    if (updated.length !== 1) {
      throw new Error('The session changed since it was loaded.');
    }
  }
  // #endregion
}
