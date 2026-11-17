import { RequestEmailChangeInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RequestEmailChangeBody
 *
 * @description
 * The body of `POST /internal/v1/users/{userId}/email-change`: the session and the new address.
 */
export class RequestEmailChangeBody extends zodDto(RequestEmailChangeInternalBody) {}
