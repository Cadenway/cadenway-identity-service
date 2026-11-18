import { AddSecurityKeyInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class AddSecurityKeyPath
 *
 * @description
 * The path of `POST /internal/v1/users/{userId}/two-step-verification/security-keys`: the account, the actor.
 */
export class AddSecurityKeyPath extends zodDto(AddSecurityKeyInternalParams) {}
