import type { AuthenticationPolicy } from '@cadenway/contracts/types/internal/identity-service';

import type { AuthenticationPolicyView } from '../../../../application/projections/authentication-policy/authentication-policy-view.projection.js';

/**
 * Function toAuthenticationPolicy
 *
 * @description
 * Maps the policy of a route to `AuthenticationPolicy` of the contract.
 *
 * @param {AuthenticationPolicyView} view - The answer of the use case.
 * @returns {AuthenticationPolicy} The body of the response.
 */
export function toAuthenticationPolicy(view: AuthenticationPolicyView): AuthenticationPolicy {
  return {
    twoStepVerificationRequiredFor: view.twoStepVerificationRequiredFor,
    sessionInactivityTimeoutMinutes: view.sessionInactivityTimeoutMinutes,
    membersWithoutTwoStepVerification: {
      admins: view.adminsWithoutTwoStepVerification,
      everyone: view.membersWithoutTwoStepVerification,
    },
    version: view.version,
  };
}
