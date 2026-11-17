import type { ApiToken } from '../../../../../domain/aggregates/api-token/api-token.aggregate.js';
import { ApiTokenNotFound } from '../../../../models/api-token/api-token-not-found.model.js';
import type { ApiTokenRepository } from '../../../../ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { Clock } from '../../../../ports/outbound/time/api-token/clock.port.js';
import type { ApiTokensUnitOfWork } from '../../../../ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import type { RevokeApiTokenInput } from './revoke-api-token.input.js';

/**
 * Class RevokeApiToken
 *
 * @description
 * Revokes a token of the actor in the organization of its internal token
 * (`DELETE /internal/v1/api-tokens/{apiTokenId}`): it introspects as inactive from the next call,
 * since the gateway checks every token without a cache. Revoking it again changes nothing; a token
 * of another user or organization, or an unknown id, is refused alike. The token is locked and
 * written in the tenant transaction of the organization.
 */
export class RevokeApiToken {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The tenant transaction of the revocation.
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
   * @param {ApiTokensUnitOfWork} unitOfWork - The tenant transaction of the revocation.
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
   * Revokes the token.
   *
   * @param {RevokeApiTokenInput} input - The actor, its organization and the token.
   * @returns {Promise<void>} Resolves once revoked, or at once when it already was.
   * @throws {ApiTokenNotFound} When no token with this id belongs to the actor there.
   */
  public async execute(input: RevokeApiTokenInput): Promise<void> {
    const now: Date = this.clock.now();
    await this.unitOfWork.run(async (tokens: ApiTokenRepository): Promise<void> => {
      const token: ApiToken | null = await tokens.lock(input.organizationId, input.apiTokenId);
      if (!token?.belongsTo(input.actorUserId, input.organizationId)) {
        throw new ApiTokenNotFound();
      }
      const revoked: ApiToken = token.revoke(now);
      if (revoked !== token) {
        await tokens.revoke(revoked);
      }
    });
  }
  // #endregion
}
