import { RevokeOtherSessionsInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RevokeOtherSessionsPath
 *
 * @description
 * The path of `POST /internal/v1/sessions/{sessionId}/revoke-others`, validated by the generated
 * validator of the contract.
 */
export class RevokeOtherSessionsPath extends zodDto(RevokeOtherSessionsInternalParams) {}
