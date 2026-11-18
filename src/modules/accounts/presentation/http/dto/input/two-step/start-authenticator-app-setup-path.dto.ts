import { StartAuthenticatorAppSetupInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class StartAuthenticatorAppSetupPath
 *
 * @description
 * The path of `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup`: the account, the actor.
 */
export class StartAuthenticatorAppSetupPath extends zodDto(
  StartAuthenticatorAppSetupInternalParams,
) {}
