import { ConfirmAuthenticatorAppSetupInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ConfirmAuthenticatorAppSetupPath
 *
 * @description
 * The path of `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup/confirmation`: the account, the
 * actor.
 */
export class ConfirmAuthenticatorAppSetupPath extends zodDto(
  ConfirmAuthenticatorAppSetupInternalParams,
) {}
