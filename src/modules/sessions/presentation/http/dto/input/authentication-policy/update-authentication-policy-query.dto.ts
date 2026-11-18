import { UpdateAuthenticationPolicyInternalQueryParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class UpdateAuthenticationPolicyQuery
 *
 * @description
 * Query of `PATCH /internal/v1/organization/authentication-policy`: `sessionId`, the session of the
 * public request, a UUID, validated with the schema of the contract (`400 request.invalid`).
 */
export class UpdateAuthenticationPolicyQuery extends zodDto(
  UpdateAuthenticationPolicyInternalQueryParams,
) {}
