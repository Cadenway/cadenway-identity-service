import { StartSecurityKeyRegistrationInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class StartSecurityKeyRegistrationPath
 *
 * @description
 * The path of `POST /internal/v1/users/{userId}/two-step-verification/security-keys/registration`: the account, the actor.
 */
export class StartSecurityKeyRegistrationPath extends zodDto(
  StartSecurityKeyRegistrationInternalParams,
) {}
