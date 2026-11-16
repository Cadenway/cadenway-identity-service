import type { SessionEvents } from '../../ports/outbound/messaging/session/session-events.port.js';
import type { SessionRepository } from '../../ports/outbound/persistence/session/session-repository.port.js';

/**
 * Interface SessionsStore
 *
 * @description
 * The repository and the outbox of one transaction.
 */
export interface SessionsStore {
  // #region Properties
  /**
   * Property sessions
   *
   * @description
   * The sessions.
   *
   * @type {SessionRepository}
   * @readonly
   */
  readonly sessions: SessionRepository;

  /**
   * Property events
   *
   * @description
   * The outbox of the transaction.
   *
   * @type {SessionEvents}
   * @readonly
   */
  readonly events: SessionEvents;
  // #endregion
}
