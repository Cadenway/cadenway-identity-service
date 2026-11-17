import { ScheduleAccountDeletionInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ScheduleAccountDeletionBody
 *
 * @description
 * The body of `POST /internal/v1/users/{userId}/deletion`: the session of the request.
 */
export class ScheduleAccountDeletionBody extends zodDto(ScheduleAccountDeletionInternalBody) {}
