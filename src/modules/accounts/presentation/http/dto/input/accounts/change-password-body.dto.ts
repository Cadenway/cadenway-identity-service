import { ChangePasswordInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ChangePasswordBody
 *
 * @description
 * The body of `PUT /internal/v1/users/{userId}/password`: the session, both passwords, never
 * logged, and the browser.
 */
export class ChangePasswordBody extends zodDto(ChangePasswordInternalBody) {}
