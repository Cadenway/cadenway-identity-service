import type { SessionEvents } from './session-events.port.js';
import type { SessionRepository } from './session-repository.port.js';

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

/**
 * Interface SessionsUnitOfWork
 *
 * @description
 * One transaction of the sessions module. Run inside the transaction of a sign-in of the accounts
 * module, it joins it: the session commits with the sign-in.
 */
export interface SessionsUnitOfWork {
  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in one transaction with the repository bound to it; commits when it resolves.
   *
   * @param {(store: SessionsStore) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  run<TResult>(work: (store: SessionsStore) => Promise<TResult>): Promise<TResult>;
  // #endregion
}
