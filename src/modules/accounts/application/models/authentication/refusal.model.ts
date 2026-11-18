/**
 * Type Refusal
 *
 * @description
 * Why a use case of the accounts module refused, with the values the contract puts in `details`.
 * Each reason is one stable `code` of `openapi/internal/identity-service.yaml` (`auth.<reason>`,
 * `user.not-found`, `session.not-found`, `security-key.not-found`, `account.organization-owner`,
 * `request.version-mismatch`); the HTTP adapter maps it, the use case never knows a status. The
 * reasons of two-step verification (P2c-2): `challenge-expired`, `two-step-setup-expired`,
 * `two-step-not-enabled`, `security-key-not-found`, `two-step-code-invalid` and
 * `security-key-refused` (with `remainingAttempts` when the answer counts), `two-step-locked`,
 * `security-key-limit-reached` and `mfa-required-by-organization`; `reauthentication-required`
 * names the methods that confirm the account.
 *
 * @type {{ readonly reason: 'terms-not-accepted' | 'password-compromised' | 'email-taken' | 'code-invalid' | 'code-expired' | 'sign-up-replaced' | 'email-not-verified' | 'user-not-found' | 'session-not-found' | 'reset-link-expired' | 'email-unchanged' | 'challenge-expired' | 'two-step-setup-expired' | 'two-step-not-enabled' | 'security-key-not-found' } | { readonly reason: 'reauthentication-required'; readonly methods: readonly ('password' | 'authenticator-app')[] } | { readonly reason: 'password-too-short'; readonly minLength: number } | { readonly reason: 'code-throttled' | 'reset-throttled'; readonly resendAvailableAt: Date } | { readonly reason: 'invalid-credentials' | 'password-incorrect'; readonly remainingAttempts: number } | { readonly reason: 'two-step-code-invalid' | 'security-key-refused'; readonly remainingAttempts: number | null } | { readonly reason: 'account-locked' | 'two-step-locked'; readonly lockedUntil: Date } | { readonly reason: 'version-mismatch'; readonly version: number } | { readonly reason: 'organization-owner' | 'mfa-required-by-organization'; readonly organizationIds: readonly string[] } | { readonly reason: 'security-key-limit-reached'; readonly maxSecurityKeys: number }}
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
        | 'email-unchanged'
        | 'challenge-expired'
        | 'two-step-setup-expired'
        | 'two-step-not-enabled'
        | 'security-key-not-found';
    }
  | {
      readonly reason: 'reauthentication-required';
      readonly methods: readonly ('password' | 'authenticator-app')[];
    }
  | { readonly reason: 'password-too-short'; readonly minLength: number }
  | { readonly reason: 'code-throttled' | 'reset-throttled'; readonly resendAvailableAt: Date }
  | {
      readonly reason: 'invalid-credentials' | 'password-incorrect';
      readonly remainingAttempts: number;
    }
  | {
      readonly reason: 'two-step-code-invalid' | 'security-key-refused';
      readonly remainingAttempts: number | null;
    }
  | { readonly reason: 'account-locked' | 'two-step-locked'; readonly lockedUntil: Date }
  | { readonly reason: 'version-mismatch'; readonly version: number }
  | {
      readonly reason: 'organization-owner' | 'mfa-required-by-organization';
      readonly organizationIds: readonly string[];
    }
  | { readonly reason: 'security-key-limit-reached'; readonly maxSecurityKeys: number };
