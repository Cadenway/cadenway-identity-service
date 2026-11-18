import { AnswerSignInChallengeWithAuthenticatorAppInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class AnswerChallengeWithAuthenticatorAppBody
 *
 * @description
 * The body of `POST /internal/v1/auth/sign-in/challenge/authenticator-app`: the token, the code of the app, `trustDevice` and the browser. The token and the code are never logged.
 */
export class AnswerChallengeWithAuthenticatorAppBody extends zodDto(
  AnswerSignInChallengeWithAuthenticatorAppInternalBody,
) {}
