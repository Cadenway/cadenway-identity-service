import { StartAuthenticatorAppSetupInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class StartAuthenticatorAppSetupBody
 *
 * @description
 * The body of `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup`: the session of the public
 * request, which the pending setup belongs to.
 */
export class StartAuthenticatorAppSetupBody extends zodDto(
  StartAuthenticatorAppSetupInternalBody,
) {}
