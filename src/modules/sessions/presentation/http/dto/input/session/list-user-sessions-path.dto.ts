import { ListUserSessionsInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ListUserSessionsPath
 *
 * @description
 * The path of `GET /internal/v1/users/{userId}/sessions`, validated by the generated validator of
 * the contract.
 */
export class ListUserSessionsPath extends zodDto(ListUserSessionsInternalParams) {}
