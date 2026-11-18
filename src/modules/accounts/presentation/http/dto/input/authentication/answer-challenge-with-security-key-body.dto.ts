import { AnswerSignInChallengeWithSecurityKeyInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class AnswerChallengeWithSecurityKeyBody
 *
 * @description
 * The body of `POST /internal/v1/auth/sign-in/challenge/security-key`: the token, the `AuthenticationResponseJSON` of the browser, `trustDevice` and the browser. The token is never logged.
 */
export class AnswerChallengeWithSecurityKeyBody extends zodDto(
  AnswerSignInChallengeWithSecurityKeyInternalBody,
) {}
