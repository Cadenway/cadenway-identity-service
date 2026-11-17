import { ListApiTokensInternalQueryParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';
import { z } from 'zod';

/**
 * Function fromQueryString
 *
 * @description
 * Reads a query parameter of digits as the integer it writes; any other value is left for the
 * schema of the contract to refuse.
 *
 * @param {unknown} value - The raw parameter.
 * @returns {unknown} A number for a string of digits, the value otherwise.
 */
function fromQueryString(value: unknown): unknown {
  return typeof value === 'string' && /^[0-9]{1,4}$/u.test(value) ? Number(value) : value;
}

/**
 * Class ListApiTokensQuery
 *
 * @description
 * Query of `GET /internal/v1/api-tokens`: `cursor` and `limit` (1 to 100, 50 by default) of the
 * contract, unknown parameters refused. The generated schema types `limit` as an integer, which a
 * query string never is: it is read from its digits first, then checked by the contract.
 */
export class ListApiTokensQuery extends zodDto(
  ListApiTokensInternalQueryParams.extend({
    limit: z.preprocess(fromQueryString, ListApiTokensInternalQueryParams.shape.limit),
  }),
) {}
