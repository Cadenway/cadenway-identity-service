import { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { findOpenSessionOf } from '../../../../services/session/open-sessions.service.js';
import type { AuthenticateSessionInput } from './authenticate-session.input.js';
import type { AuthenticateSessionOutput } from './authenticate-session.output.js';

/**
 * Class AuthenticateSession
 *
 * @description
 * Records that the person of an open session proved who they are now (a confirmed password, the
 * current password of a change), which opens its 10-minute window of recent authentication
 * (decision 4 of P2c). Runs in the system transaction of the accounts module and joins it; the
 * session is locked.
 */
export class AuthenticateSession {
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
   * The time of the proof.
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
   * Takes the ports of the recording.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction.
   * @param {Clock} clock - The time of the proof.
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
   * Records the recent authentication.
   *
   * @param {AuthenticateSessionInput} input - The person and the session.
   * @returns {Promise<AuthenticateSessionOutput | null>} The window, or `null` when the session is
   * not an open session of the person.
   */
  public async execute(input: AuthenticateSessionInput): Promise<AuthenticateSessionOutput | null> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (store: SessionsStore): Promise<AuthenticateSessionOutput | null> => {
        const session: Session | null = await findOpenSessionOf(
          store,
          input.userId,
          input.sessionId,
          now,
          true,
        );
        if (session === null) {
          return null;
        }
        await store.sessions.saveAuthentication(session.authenticate(now));
        return {
          authenticatedAt: now,
          expiresAt: new Date(now.getTime() + Session.RECENT_AUTHENTICATION_MS),
        };
      },
    );
  }
  // #endregion
}
