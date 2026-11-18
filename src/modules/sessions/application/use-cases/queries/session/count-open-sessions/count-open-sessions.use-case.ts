import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { CountOpenSessionsInput } from './count-open-sessions.input.js';
import type { CountOpenSessionsOutput } from './count-open-sessions.output.js';

/**
 * Class CountOpenSessions
 *
 * @description
 * Counts the open sessions of an account, for the reset screen ("3 appareils connectés seront
 * déconnectés", `POST /internal/v1/auth/password-reset/inspection`). Runs in the system transaction
 * of the accounts module and joins it.
 */
export class CountOpenSessions {
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
   * The time of the count.
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
   * Takes the ports of the count.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction.
   * @param {Clock} clock - The time of the count.
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
   * Counts the open sessions.
   *
   * @param {CountOpenSessionsInput} input - The account.
   * @returns {Promise<CountOpenSessionsOutput>} The count.
   */
  public async execute(input: CountOpenSessionsInput): Promise<CountOpenSessionsOutput> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: SessionsStore): Promise<CountOpenSessionsOutput> => ({
      count: await store.sessions.countOpen(input.userId, now),
    }));
  }
  // #endregion
}
