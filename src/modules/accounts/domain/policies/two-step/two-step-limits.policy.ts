/**
 * Constant TWO_STEP_LIMITS
 *
 * @description
 * The lifetimes and bounds of two-step verification (decision 7 of P2c and
 * `openapi/internal/identity-service.yaml`): a pending setup of the app lives 15 minutes, a pending
 * registration of a key and the WebAuthn options of a challenge 5 minutes, an account has at most
 * 10 security keys and 10 backup codes, and a key name has 1 to 60 characters once trimmed.
 *
 * @type {{ readonly setupLifetimeMs: number; readonly registrationLifetimeMs: number; readonly maxSecurityKeys: number; readonly backupCodeCount: number; readonly securityKeyNameMaxLength: number }}
 */
export const TWO_STEP_LIMITS: {
  readonly setupLifetimeMs: number;
  readonly registrationLifetimeMs: number;
  readonly maxSecurityKeys: number;
  readonly backupCodeCount: number;
  readonly securityKeyNameMaxLength: number;
} = {
  setupLifetimeMs: 15 * 60_000,
  registrationLifetimeMs: 5 * 60_000,
  maxSecurityKeys: 10,
  backupCodeCount: 10,
  securityKeyNameMaxLength: 60,
};
