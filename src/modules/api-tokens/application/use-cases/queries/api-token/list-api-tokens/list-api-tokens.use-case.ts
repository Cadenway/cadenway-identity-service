import type { ApiToken } from '../../../../../domain/aggregates/api-token/api-token.aggregate.js';
import { toApiTokenView } from '../../../../mappers/api-token/api-token-view.mapper.js';
import type { ApiTokenRepository } from '../../../../ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { Clock } from '../../../../ports/outbound/time/api-token/clock.port.js';
import type { ApiTokensUnitOfWork } from '../../../../ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import type { ListApiTokensInput } from './list-api-tokens.input.js';
import type { ListApiTokensOutput } from './list-api-tokens.output.js';

/**
 * Class ListApiTokens
 *
 * @description
 * Lists the tokens of the actor in the organization of its internal token that are neither revoked
 * nor expired, the most recently created first, a page at a time (`GET /internal/v1/api-tokens`).
 * It reads one token more than the page to know whether another page follows. A token is never
 * listed with its secret.
 */
export class ListApiTokens {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The tenant transaction of the list.
   *
   * @type {ApiTokensUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: ApiTokensUnitOfWork;

  /**
   * Property clock
   *
   * @description
   * The time of the list, against which an expiry is compared.
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
   * Takes the ports of the list.
   *
   * @param {ApiTokensUnitOfWork} unitOfWork - The tenant transaction of the list.
   * @param {Clock} clock - The time of the list.
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
   * Reads one page of tokens.
   *
   * @param {ListApiTokensInput} input - The actor, its organization and the page.
   * @returns {Promise<ListApiTokensOutput>} The tokens and where the next page starts.
   */
  public async execute(input: ListApiTokensInput): Promise<ListApiTokensOutput> {
    const now: Date = this.clock.now();
    const rows: ApiToken[] = await this.unitOfWork.run(
      (tokens: ApiTokenRepository): Promise<ApiToken[]> =>
        tokens.listActive(
          input.organizationId,
          input.actorUserId,
          now,
          input.after,
          input.limit + 1,
        ),
    );
    const page: ApiToken[] = rows.slice(0, input.limit);
    const last: ApiToken | undefined = page.at(-1);
    return {
      items: page.map(toApiTokenView),
      next:
        rows.length > input.limit && last !== undefined
          ? { createdAt: last.snapshot.createdAt, id: last.id }
          : null,
    };
  }
  // #endregion
}
