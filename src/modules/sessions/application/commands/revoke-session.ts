import { SessionEndedError } from '../../domain/errors.js';
import type { Session } from '../../domain/session.js';
import type { Clock } from '../ports/clock.port.js';
import type { SessionsStore, SessionsUnitOfWork } from '../ports/sessions-unit-of-work.port.js';
import { SessionNotFound } from '../session-refusal.js';

/**
 * Interface RevokeSessionInput
 *
 * @description
 * Who revokes which session.
 */
export interface RevokeSessionInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The user of the verified internal token, never a value of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session, as the introspection returned it.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}

/**
 * Class RevokeSession
 *
 * @description
 * Ends a session of the actor (`DELETE /internal/v1/sessions/{sessionId}`, the sign-out): its token
 * is inactive from the next introspection, and `session.revoked.v1` is appended in the same
 * transaction. Revoking a session that already ended changes nothing and appends nothing, so a
 * second sign-out is not an error. A session of another user, or an unknown id, is refused alike.
 */
export class RevokeSession {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the revocation.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property clock
   *
   * @description
   * The time of the revocation.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the ports of the revocation.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The transaction of the revocation.
   * @param {Clock} clock - The time of the revocation.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Revokes the session.
   *
   * @param {RevokeSessionInput} input - The actor and the session.
   * @returns {Promise<void>} Resolves once revoked, or at once when it had already ended.
   * @throws {SessionNotFound} When no session with this id belongs to the actor.
   */
  public async execute(input: RevokeSessionInput): Promise<void> {
    const now: Date = this.clock.now();
    await this.unitOfWork.run(async (store: SessionsStore): Promise<void> => {
      const session: Session | null = await store.sessions.findForUpdate(input.sessionId);
      if (session?.userId !== input.actorUserId) {
        throw new SessionNotFound();
      }
      let revoked: Session;
      try {
        revoked = session.revoke(now);
      } catch (error) {
        if (error instanceof SessionEndedError) {
          return;
        }
        throw error;
      }
      await store.sessions.revoke(revoked);
      await store.events.sessionRevoked(revoked, input.actorUserId);
    });
  }
  // #endregion
}
