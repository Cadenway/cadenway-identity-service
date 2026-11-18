import { UpdateAuthenticationPolicyInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class UpdateAuthenticationPolicyBody
 *
 * @description
 * Body of `PATCH /internal/v1/organization/authentication-policy`, a JSON Merge Patch validated
 * with the schema of the contract: the values it lists only (`400 request.invalid`).
 */
export class UpdateAuthenticationPolicyBody extends zodDto(
  UpdateAuthenticationPolicyInternalBody,
) {}
