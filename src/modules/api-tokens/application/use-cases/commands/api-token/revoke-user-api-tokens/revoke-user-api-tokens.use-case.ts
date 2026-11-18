import type { ApiToken } from '../../../../../domain/aggregates/api-token/api-token.aggregate.js';
import type { ApiTokenRepository } from '../../../../ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { Clock } from '../../../../ports/outbound/time/api-token/clock.port.js';
import type { ApiTokensUnitOfWork } from '../../../../ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import type { RevokeUserApiTokensInput } from './revoke-user-api-tokens.input.js';
import type { RevokeUserApiTokensOutput } from './revoke-user-api-tokens.output.js';

/**
 * Class RevokeUserApiTokens
 *
 * @description
 * Revokes every personal API token of a person, in every organization, when the deletion of the
 * account is scheduled (`POST /internal/v1/users/{userId}/deletion`, decision 9 of P2c: "every
 * session and token revoked at once"). Runs in the system transaction of the accounts module and
 * joins it: the system access lifts the policy of `api_tokens` for the rows of this person only,
 * named by `user_id`. The tokens are locked, then revoked one by one with the next version.
 */
export class RevokeUserApiTokens {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction, joined to the one of the caller.
   *
   * @type {ApiTokensUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: ApiTokensUnitOfWork;

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
   * @param {ApiTokensUnitOfWork} unitOfWork - The system transaction.
   * @param {Clock} clock - The time of the revocation.
   * @constructor
   */
  public constructor(unitOfWork: ApiTokensUnitOfWork, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Revokes the tokens.
   *
   * @param {RevokeUserApiTokensInput} input - The person.
   * @returns {Promise<RevokeUserApiTokensOutput>} How many were revoked.
   */
  public async execute(input: RevokeUserApiTokensInput): Promise<RevokeUserApiTokensOutput> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (tokens: ApiTokenRepository): Promise<RevokeUserApiTokensOutput> => {
        const unrevoked: ApiToken[] = await tokens.lockUnrevokedOfUser(input.userId);
        for (const token of unrevoked) {
          await tokens.revoke(token.revoke(now));
        }
        return { revokedCount: unrevoked.length };
      },
    );
  }
  // #endregion
}
