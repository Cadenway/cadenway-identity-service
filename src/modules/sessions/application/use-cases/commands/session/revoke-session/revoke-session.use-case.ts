import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import { SessionEndedError } from '../../../../../domain/errors/session/session-ended.error.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { RevokeSessionInput } from './revoke-session.input.js';

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
