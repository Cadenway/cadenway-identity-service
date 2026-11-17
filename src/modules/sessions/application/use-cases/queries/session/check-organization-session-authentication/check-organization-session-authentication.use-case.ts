import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { checkSessionAuthentication } from '../../../../services/session/session-authentication.service.js';
import type { CheckOrganizationSessionAuthenticationInput } from './check-organization-session-authentication.input.js';
import type { CheckOrganizationSessionAuthenticationOutput } from './check-organization-session-authentication.output.js';

/**
 * Class CheckOrganizationSessionAuthentication
 *
 * @description
 * The recent authentication of the session of a request that carries an organization: the
 * creation of a personal API token (`POST /internal/v1/api-tokens`), which runs in the tenant
 * transaction of the current organization of the session. It joins that transaction, so the check
 * and the creation commit together, and never opens a system one for a request with an
 * organization. Row-level security shows it the session only while the session acts on that
 * organization, the one the gateway put in the internal token; a session that chose another one
 * since answers `not-found`.
 */
export class CheckOrganizationSessionAuthentication {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The tenant transaction, joined to the one of the caller.
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
   * @param {SessionsUnitOfWork} unitOfWork - The tenant transaction.
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
   * Checks the session and locks it until the end of the transaction it joins: the scheduling of
   * the deletion of the account locks every open session before it revokes the API tokens, so it
   * either waits for the token this check guards and revokes it, or revokes the session first and
   * this check finds it ended.
   *
   * @param {CheckOrganizationSessionAuthenticationInput} input - The person and the session.
   * @returns {Promise<CheckOrganizationSessionAuthenticationOutput>} `recent`, `stale` or `not-found`.
   */
  public async execute(
    input: CheckOrganizationSessionAuthenticationInput,
  ): Promise<CheckOrganizationSessionAuthenticationOutput> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (store: SessionsStore): Promise<CheckOrganizationSessionAuthenticationOutput> => ({
        status: await checkSessionAuthentication(store, input.userId, input.sessionId, now, true),
      }),
    );
  }
  // #endregion
}
