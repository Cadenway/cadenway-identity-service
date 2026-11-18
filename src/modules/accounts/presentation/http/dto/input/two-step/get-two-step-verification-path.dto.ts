import { GetTwoStepVerificationInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class GetTwoStepVerificationPath
 *
 * @description
 * The path of `GET /internal/v1/users/{userId}/two-step-verification`: the account, the actor.
 */
export class GetTwoStepVerificationPath extends zodDto(GetTwoStepVerificationInternalParams) {}
