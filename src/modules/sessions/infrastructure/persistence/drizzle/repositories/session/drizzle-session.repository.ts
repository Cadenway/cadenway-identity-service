import type { TransactionDatabase } from '@cadenway/nest-common/database';
import { and, count, desc, eq, getTableColumns, gt, isNull, lt, max, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import type { SessionOrigin } from '../../../../../application/models/session/session-origin.model.js';
import type { SessionPosition } from '../../../../../application/models/session/session-position.model.js';
import type { SessionRecord } from '../../../../../application/models/session/session-record.model.js';
import type { SessionRepository } from '../../../../../application/ports/outbound/persistence/session/session-repository.port.js';
import { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type { SessionStart } from '../../../../../domain/value-objects/session/session-start.value-object.js';
import { toSession } from '../../mappers/session/session.mapper.js';
import type { SessionRow } from '../../mappers/session/session.mapper.js';
import policies from '../../schemas/authentication-policy/authentication-policy.schema.js';
import sessions from '../../schemas/session/session.schema.js';

/**
 * Function label
 *
 * @description
 * The label a column of the device keeps for the record ("Firefox 132"), or `null`.
 *
 * @param {string | null} name - The name.
 * @param {string | null} version - The version, or `null`.
 * @returns {string | null} The label.
 */
function label(name: string | null, version: string | null): string | null {
  if (name === null) {
    return null;
  }
  return version === null ? name : `${name} ${version}`;
}

/**
 * Function openAt
 *
 * @description
 * The condition of a session open at an instant: neither revoked, expired nor idle for the
 * inactivity of the policy of its organization, the same rule as `Session.isActiveAt`. The first
 * bound on `last_active_at`, the longest inactivity a policy allows, keeps the comparison simple for
 * the planner; the second applies the inactivity of each session.
 *
 * @param {Date} now - The instant.
 * @returns {SQL | undefined} The condition.
 */
function openAt(now: Date): SQL | undefined {
  return and(
    isNull(sessions.revokedAt),
    gt(sessions.expiresAt, now),
    gt(
      sessions.lastActiveAt,
      new Date(now.getTime() - Session.LONGEST_INACTIVITY_TIMEOUT_MINUTES * 60_000),
    ),
    sql`${sessions.lastActiveAt} + make_interval(mins => ${INACTIVITY_TIMEOUT_MINUTES}) > ${now.toISOString()}::timestamptz`,
  );
}

/**
 * Constant INACTIVITY_TIMEOUT_MINUTES
 *
 * @description
 * The inactivity of a session, in minutes: the one of the policy of the organization it names, 720
 * without an organization or a policy (decision 8 of P2c). A correlated subquery rather than a
 * join, so that `for update` locks the session rows only; read through the primary key of
 * `authentication_policies`.
 *
 * @type {SQL<number>}
 */
const INACTIVITY_TIMEOUT_MINUTES: SQL<number> = sql<number>`coalesce((
    select ${policies.sessionInactivityTimeoutMinutes}
    from ${policies}
    where ${policies}.${sql.identifier(policies.organizationId.name)}
      = ${sessions}.${sql.identifier(sessions.organizationId.name)}
  ), ${sql.raw(String(Session.DEFAULT_INACTIVITY_TIMEOUT_MINUTES))})`.mapWith(Number);

/**
 * Constant SESSION_COLUMNS
 *
 * @description
 * The columns of a session row, with the inactivity of its organization.
 *
 * @type {typeof sessions._.columns & { inactivityTimeoutMinutes: SQL<number> }}
 */
const SESSION_COLUMNS: typeof sessions._.columns & { inactivityTimeoutMinutes: SQL<number> } = {
  ...getTableColumns(sessions),
  inactivityTimeoutMinutes: INACTIVITY_TIMEOUT_MINUTES,
};

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
        browser: label(origin.device.browser, origin.device.browserVersion),
        operatingSystem: label(origin.device.os, origin.device.osVersion),
        deviceType: origin.device.type === 'unknown' ? null : origin.device.type,
        organizationId: start.organizationId,
        memberId: start.memberId,
        samlOrganizationId: start.samlMembership?.organizationId ?? null,
        samlMemberId: start.samlMembership?.memberId ?? null,
        lastActiveAt: start.lastActiveAt,
        expiresAt: start.expiresAt,
        signedInAt: start.signedInAt,
        authenticatedAt: start.authenticatedAt,
        twoStepAuthenticatedAt: start.twoStepAuthenticatedAt,
        version: start.version,
      })
      .returning(SESSION_COLUMNS);
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
      .select(SESSION_COLUMNS)
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
      .select(SESSION_COLUMNS)
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

  /**
   * Method findById
   *
   * @description
   * Reads a session by its id, without a lock.
   *
   * @param {string} id - Id of the session.
   * @returns {Promise<Session | null>} The session, or `null`.
   */
  public async findById(id: string): Promise<Session | null> {
    const rows: SessionRow[] = await this.db
      .select(SESSION_COLUMNS)
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    const row: SessionRow | undefined = rows[0];
    return row === undefined ? null : toSession(row);
  }

  /**
   * Method lockOpenOfUser
   *
   * @description
   * Reads and locks the open sessions of an account, through the index on `user_id`.
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @returns {Promise<Session[]>} The open sessions.
   */
  public async lockOpenOfUser(userId: string, now: Date): Promise<Session[]> {
    const rows: SessionRow[] = await this.db
      .select(SESSION_COLUMNS)
      .from(sessions)
      .where(and(eq(sessions.userId, userId), openAt(now)))
      .orderBy(sessions.id)
      .for('update');
    return rows.map(toSession);
  }

  /**
   * Method lockUnendedOfUser
   *
   * @description
   * Reads and locks the sessions of an account neither revoked nor expired, idle ones included,
   * through the index on `user_id`, in the order of their ids.
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @returns {Promise<Session[]>} The unended sessions.
   */
  public async lockUnendedOfUser(userId: string, now: Date): Promise<Session[]> {
    const rows: SessionRow[] = await this.db
      .select(SESSION_COLUMNS)
      .from(sessions)
      .where(
        and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
      )
      .orderBy(sessions.id)
      .for('update');
    return rows.map(toSession);
  }

  /**
   * Method countOpen
   *
   * @description
   * Counts the open sessions of an account, through the index on `user_id`.
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @returns {Promise<number>} The open sessions.
   */
  public async countOpen(userId: string, now: Date): Promise<number> {
    const rows: { count: number }[] = await this.db
      .select({ count: count() })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), openAt(now)));
    return rows[0]?.count ?? 0;
  }

  /**
   * Method listOpen
   *
   * @description
   * Reads one page of the open sessions of an account through the index on `user_id`, the most
   * recent sign-in first (`signed_in_at`, then `id`).
   *
   * @param {string} userId - The account.
   * @param {Date} now - The instant.
   * @param {SessionPosition | null} after - The end of the previous page, or `null`.
   * @param {number} limit - Sessions to read at most.
   * @returns {Promise<SessionRecord[]>} The sessions with their browser.
   */
  public async listOpen(
    userId: string,
    now: Date,
    after: SessionPosition | null,
    limit: number,
  ): Promise<SessionRecord[]> {
    const conditions: (SQL | undefined)[] = [eq(sessions.userId, userId), openAt(now)];
    if (after !== null) {
      conditions.push(
        or(
          lt(sessions.signedInAt, after.signedInAt),
          and(eq(sessions.signedInAt, after.signedInAt), lt(sessions.id, after.id)),
        ),
      );
    }
    const rows: SessionRow[] = await this.db
      .select(SESSION_COLUMNS)
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.signedInAt), desc(sessions.id))
      .limit(limit);
    return rows.map((row: SessionRow): SessionRecord => ({
      session: toSession(row),
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    }));
  }

  /**
   * Method findUserAgentsSince
   *
   * @description
   * Reads the distinct `User-Agent` of the sessions of an account active since an instant, through
   * the index on `user_id`, the one used last first.
   *
   * @param {string} userId - The account.
   * @param {Date} since - The instant.
   * @param {number} limit - Headers to read at most.
   * @returns {Promise<(string | null)[]>} The headers.
   */
  public async findUserAgentsSince(
    userId: string,
    since: Date,
    limit: number,
  ): Promise<(string | null)[]> {
    const rows: { userAgent: string | null }[] = await this.db
      .select({ userAgent: sessions.userAgent })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.lastActiveAt, since)))
      .groupBy(sessions.userAgent)
      .orderBy(desc(max(sessions.lastActiveAt)))
      .limit(limit);
    return rows.map((row: { userAgent: string | null }) => row.userAgent);
  }

  /**
   * Method saveAuthentication
   *
   * @description
   * Writes the recent authentication of a session, or its end. It is not a change of version.
   *
   * @param {Session} session - The session after the change.
   * @returns {Promise<void>} Resolves once written.
   */
  public async saveAuthentication(session: Session): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        authenticatedAt: session.snapshot.authenticatedAt,
        twoStepAuthenticatedAt: session.snapshot.twoStepAuthenticatedAt,
      })
      .where(eq(sessions.id, session.id));
  }

  /**
   * Method eraseOfUser
   *
   * @description
   * Deletes every session of an account, through the index on `user_id`.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async eraseOfUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
  // #endregion
}
