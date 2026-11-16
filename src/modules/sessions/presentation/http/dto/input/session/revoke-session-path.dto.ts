import { RevokeSessionParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RevokeSessionPath
 *
 * @description
 * Path of `DELETE /internal/v1/sessions/{sessionId}`: a UUID, else `400 request.invalid`.
 */
export class RevokeSessionPath extends zodDto(RevokeSessionParams) {}
