import { ReauthenticateInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ReauthenticatePath
 *
 * @description
 * The path of `POST /internal/v1/sessions/{sessionId}/reauthentication`.
 */
export class ReauthenticatePath extends zodDto(ReauthenticateInternalParams) {}
