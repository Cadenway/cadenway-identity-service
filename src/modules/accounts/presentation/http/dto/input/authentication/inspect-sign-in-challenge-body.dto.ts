import { InspectSignInChallengeInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class InspectSignInChallengeBody
 *
 * @description
 * The body of `POST /internal/v1/auth/sign-in/challenge/inspection`: the token of the challenge, a
 * secret never logged.
 */
export class InspectSignInChallengeBody extends zodDto(InspectSignInChallengeInternalBody) {}
