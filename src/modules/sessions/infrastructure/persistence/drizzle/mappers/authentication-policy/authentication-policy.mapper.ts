import { AuthenticationPolicy } from '../../../../../domain/aggregates/authentication-policy/authentication-policy.aggregate.js';
import type { TwoStepRequiredFor } from '../../../../../domain/value-objects/authentication-policy/two-step-required-for.value-object.js';
import type policies from '../../schemas/authentication-policy/authentication-policy.schema.js';

/**
 * Function toAuthenticationPolicy
 *
 * @description
 * Maps a row of `authentication_policies` to its policy; a value outside the check constraint of
 * the table is refused by `AuthenticationPolicy.restore`.
 *
 * @param {typeof policies.$inferSelect} row - The row.
 * @returns {AuthenticationPolicy} The policy.
 */
export function toAuthenticationPolicy(row: typeof policies.$inferSelect): AuthenticationPolicy {
  return AuthenticationPolicy.restore({
    organizationId: row.organizationId,
    twoStepVerificationRequiredFor: row.twoStepVerificationRequiredFor as TwoStepRequiredFor,
    sessionInactivityTimeoutMinutes: row.sessionInactivityTimeoutMinutes,
    version: row.version,
  });
}
