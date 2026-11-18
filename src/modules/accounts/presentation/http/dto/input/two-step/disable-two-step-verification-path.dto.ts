import { DisableTwoStepVerificationInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class DisableTwoStepVerificationPath
 *
 * @description
 * The path of `POST /internal/v1/users/{userId}/two-step-verification/disable`: the account, the actor.
 */
export class DisableTwoStepVerificationPath extends zodDto(
  DisableTwoStepVerificationInternalParams,
) {}
