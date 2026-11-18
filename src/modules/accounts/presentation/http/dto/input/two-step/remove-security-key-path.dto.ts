import { RemoveSecurityKeyInternalParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RemoveSecurityKeyPath
 *
 * @description
 * The path of `POST /internal/v1/users/{userId}/two-step-verification/security-keys/{securityKeyId}/remove`: the account and the
 * key.
 */
export class RemoveSecurityKeyPath extends zodDto(RemoveSecurityKeyInternalParams) {}
