import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { checkSessionAuthentication } from '../../../../services/session/session-authentication.service.js';
import type { CheckSessionAuthenticationInput } from './check-session-authentication.input.js';
import type { CheckSessionAuthenticationOutput } from './check-session-authentication.output.js';

/**
 * Class CheckSessionAuthentication
 *
 * @description
 * The recent authentication of the session of a request, for the guarded routes of the accounts
 * module (the change of address, the scheduling of the deletion) and the other routes of a person
 * about their own account. Runs in the system transaction of its caller and joins it; it reads one
 * session by its id and checks it belongs to the person.
 */
export class CheckSessionAuthentication {
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
   * The time of the request.
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
   * Takes the ports of the check.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction.
   * @param {Clock} clock - The time of the request.
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
   * Checks the session.
   *
   * @param {CheckSessionAuthenticationInput} input - The person and the session.
   * @returns {Promise<CheckSessionAuthenticationOutput>} `recent`, `stale` or `not-found`.
   */
  public async execute(
    input: CheckSessionAuthenticationInput,
  ): Promise<CheckSessionAuthenticationOutput> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (store: SessionsStore): Promise<CheckSessionAuthenticationOutput> => ({
        status: await checkSessionAuthentication(store, input.userId, input.sessionId, now, false),
      }),
    );
  }
  // #endregion
}
