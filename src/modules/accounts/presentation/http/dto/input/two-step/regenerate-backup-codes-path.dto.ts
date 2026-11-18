import { RegenerateBackupCodesInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RegenerateBackupCodesPath
 *
 * @description
 * The path of `POST /internal/v1/users/{userId}/two-step-verification/backup-codes/regenerate`: the account, the actor.
 */
export class RegenerateBackupCodesPath extends zodDto(RegenerateBackupCodesInternalParams) {}
