import { ConfirmPasswordResetInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ConfirmPasswordResetBody
 *
 * @description
 * The body of `POST /internal/v1/auth/password-reset/confirmation`: the token, the new password,
 * `closeOtherSessions` (`true` by default) and the browser; the token and the password are never
 * logged.
 */
export class ConfirmPasswordResetBody extends zodDto(ConfirmPasswordResetInternalBody) {}
