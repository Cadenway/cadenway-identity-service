import { GetSignInChallengeSecurityKeyOptionsInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class SecurityKeyOptionsBody
 *
 * @description
 * The body of `POST /internal/v1/auth/sign-in/challenge/security-key/options`: the token of the
 * challenge, a secret never logged.
 */
export class SecurityKeyOptionsBody extends zodDto(
  GetSignInChallengeSecurityKeyOptionsInternalBody,
) {}
