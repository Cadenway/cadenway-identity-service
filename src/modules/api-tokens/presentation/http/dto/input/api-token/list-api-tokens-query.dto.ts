import { ListApiTokensInternalQueryParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ListApiTokensQuery
 *
 * @description
 * Query of `GET /internal/v1/api-tokens`: `cursor` and `limit` (1 to 100, 50 by default) of the
 * contract, unknown parameters refused. The generated schema reads `limit` from its text with
 * `Number()` and refuses any value that is not then a whole number from 1 to 100.
 */
export class ListApiTokensQuery extends zodDto(ListApiTokensInternalQueryParams) {}
