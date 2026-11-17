import { RevokeApiTokenInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RevokeApiTokenPath
 *
 * @description
 * Path of `DELETE /internal/v1/api-tokens/{apiTokenId}`: a UUID, else `400 request.invalid`.
 */
export class RevokeApiTokenPath extends zodDto(RevokeApiTokenInternalParams) {}
