import { RemoveSecurityKeyInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RemoveSecurityKeyBody
 *
 * @description
 * The body of `POST /internal/v1/users/{userId}/two-step-verification/security-keys/{securityKeyId}/remove`: the session of
 * the public request and the browser of the change.
 */
export class RemoveSecurityKeyBody extends zodDto(RemoveSecurityKeyInternalBody) {}
