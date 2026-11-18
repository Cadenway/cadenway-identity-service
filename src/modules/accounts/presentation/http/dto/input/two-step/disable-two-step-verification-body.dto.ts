import { DisableTwoStepVerificationInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class DisableTwoStepVerificationBody
 *
 * @description
 * The body of `POST /internal/v1/users/{userId}/two-step-verification/disable`: the session of the public request and the
 * browser of the change.
 */
export class DisableTwoStepVerificationBody extends zodDto(
  DisableTwoStepVerificationInternalBody,
) {}
