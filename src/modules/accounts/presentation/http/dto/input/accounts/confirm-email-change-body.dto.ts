import { ConfirmEmailChangeInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ConfirmEmailChangeBody
 *
 * @description
 * The body of `POST /internal/v1/users/{userId}/email-change/confirmation`: the session, the code,
 * never logged, and the browser.
 */
export class ConfirmEmailChangeBody extends zodDto(ConfirmEmailChangeInternalBody) {}
