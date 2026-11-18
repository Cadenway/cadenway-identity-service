import { ReauthenticateInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ReauthenticateBody
 *
 * @description
 * The body of `POST /internal/v1/sessions/{sessionId}/reauthentication`: the password, never
 * logged.
 */
export class ReauthenticateBody extends zodDto(ReauthenticateInternalBody) {}
