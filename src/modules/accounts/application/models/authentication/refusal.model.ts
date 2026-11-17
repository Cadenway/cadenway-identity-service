/**
 * Type Refusal
 *
 * @description
 * Why a use case of the accounts module refused, with the values the contract puts in `details`.
 * Each reason is one stable `code` of `openapi/internal/identity-service.yaml` (`auth.<reason>`,
 * `user.not-found`, `session.not-found`, `account.organization-owner`,
 * `request.version-mismatch`); the HTTP adapter maps it, the use case never knows a status.
 *
 * @type {{ readonly reason: 'terms-not-accepted' | 'password-compromised' | 'email-taken' | 'code-invalid' | 'code-expired' | 'sign-up-replaced' | 'email-not-verified' | 'user-not-found' | 'session-not-found' | 'reset-link-expired' | 'reauthentication-required' | 'email-unchanged' } | { readonly reason: 'password-too-short'; readonly minLength: number } | { readonly reason: 'code-throttled' | 'reset-throttled'; readonly resendAvailableAt: Date } | { readonly reason: 'invalid-credentials' | 'password-incorrect'; readonly remainingAttempts: number } | { readonly reason: 'account-locked'; readonly lockedUntil: Date } | { readonly reason: 'version-mismatch'; readonly version: number } | { readonly reason: 'organization-owner'; readonly organizationIds: readonly string[] }}
 */
export type Refusal =
  | {
      readonly reason:
        | 'terms-not-accepted'
        | 'password-compromised'
        | 'email-taken'
        | 'code-invalid'
        | 'code-expired'
        | 'sign-up-replaced'
        | 'email-not-verified'
        | 'user-not-found'
        | 'session-not-found'
        | 'reset-link-expired'
        | 'reauthentication-required'
        | 'email-unchanged';
    }
  | { readonly reason: 'password-too-short'; readonly minLength: number }
  | { readonly reason: 'code-throttled' | 'reset-throttled'; readonly resendAvailableAt: Date }
  | {
      readonly reason: 'invalid-credentials' | 'password-incorrect';
      readonly remainingAttempts: number;
    }
  | { readonly reason: 'account-locked'; readonly lockedUntil: Date }
  | { readonly reason: 'version-mismatch'; readonly version: number }
  | { readonly reason: 'organization-owner'; readonly organizationIds: readonly string[] };
