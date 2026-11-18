import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { EndRecentAuthenticationInput } from './end-recent-authentication.input.js';

/**
 * Class EndRecentAuthentication
 *
 * @description
 * Ends the recent authentication of the open sessions of a person, but one: a change of the
 * password keeps the other sessions open but makes them prove who they are again before a guarded
 * route, and a reset that leaves them open does the same to all of them
 * (`PUT /internal/v1/users/{userId}/password`, `POST /internal/v1/auth/password-reset/confirmation`).
 * Runs in the system transaction of the accounts module and joins it; the sessions are locked.
 */
export class EndRecentAuthentication {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction, joined to the one of the caller.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property clock
   *
   * @description
   * The time of the change.
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
   * Takes the ports of the change.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction.
   * @param {Clock} clock - The time of the change.
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
   * Ends the recent authentication of the sessions.
   *
   * @param {EndRecentAuthenticationInput} input - The person and the session that keeps its own.
   * @returns {Promise<void>} Resolves once written.
   */
  public async execute(input: EndRecentAuthenticationInput): Promise<void> {
    const now: Date = this.clock.now();
    await this.unitOfWork.run(async (store: SessionsStore): Promise<void> => {
      const open: Session[] = await store.sessions.lockOpenOfUser(input.userId, now);
      for (const session of open) {
        const ended: Session = session.endRecentAuthentication(input.scope);
        if (session.id !== input.exceptSessionId && ended !== session) {
          await store.sessions.saveAuthentication(ended);
        }
      }
    });
  }
  // #endregion
}
