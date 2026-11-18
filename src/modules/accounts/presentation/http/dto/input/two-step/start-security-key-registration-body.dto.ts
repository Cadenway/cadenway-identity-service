import { StartSecurityKeyRegistrationInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class StartSecurityKeyRegistrationBody
 *
 * @description
 * The body of `POST /internal/v1/users/{userId}/two-step-verification/security-keys/registration`: the session of the public
 * request, which the pending registration belongs to.
 */
export class StartSecurityKeyRegistrationBody extends zodDto(
  StartSecurityKeyRegistrationInternalBody,
) {}
