import { InspectPasswordResetLinkInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class InspectPasswordResetLinkBody
 *
 * @description
 * The body of `POST /internal/v1/auth/password-reset/inspection`: the token of the link, never
 * logged.
 */
export class InspectPasswordResetLinkBody extends zodDto(InspectPasswordResetLinkInternalBody) {}
