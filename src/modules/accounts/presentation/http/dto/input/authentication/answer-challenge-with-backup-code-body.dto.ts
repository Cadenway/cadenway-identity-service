import { AnswerSignInChallengeWithBackupCodeInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class AnswerChallengeWithBackupCodeBody
 *
 * @description
 * The body of `POST /internal/v1/auth/sign-in/challenge/backup-code`: the token, the backup code, `trustDevice` and the browser. The token and the code are never logged.
 */
export class AnswerChallengeWithBackupCodeBody extends zodDto(
  AnswerSignInChallengeWithBackupCodeInternalBody,
) {}
