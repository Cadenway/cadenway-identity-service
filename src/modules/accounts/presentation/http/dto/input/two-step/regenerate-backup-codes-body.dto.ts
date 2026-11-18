import { RegenerateBackupCodesInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RegenerateBackupCodesBody
 *
 * @description
 * The body of `POST /internal/v1/users/{userId}/two-step-verification/backup-codes/regenerate`: the session of the public
 * request and the browser of the change.
 */
export class RegenerateBackupCodesBody extends zodDto(RegenerateBackupCodesInternalBody) {}
