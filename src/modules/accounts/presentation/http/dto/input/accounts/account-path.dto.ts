import { ChangePasswordInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class AccountPath
 *
 * @description
 * The path of the routes of the security of an account (`/internal/v1/users/{userId}/password`,
 * `/email-change`, `/email-change/confirmation`, `/deletion`): the id of the account, which must be
 * the actor. Their four generated validators of the path are the same.
 */
export class AccountPath extends zodDto(ChangePasswordInternalParams) {}
