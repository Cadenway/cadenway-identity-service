import { ListUserSessionsInternalQueryParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ListUserSessionsQuery
 *
 * @description
 * The query of `GET /internal/v1/users/{userId}/sessions` (`currentSessionId`, `cursor`, `limit`),
 * validated by the generated validator of the contract, which reads `limit` from its text.
 */
export class ListUserSessionsQuery extends zodDto(ListUserSessionsInternalQueryParams) {}
