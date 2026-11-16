import { PasswordLockout } from './password-lockout.policy.js';

/**
 * Type PasswordFailure
 *
 * @description
 * Outcome of a failed password sign-in: the lockout to store, and either the attempts left before
 * the lockout (`remainingAttempts`, at least 1) or the end of the lockout it started.
 *
 * @type {{ readonly lockout: PasswordLockout; readonly remainingAttempts: number; readonly lockedUntil: null } | { readonly lockout: PasswordLockout; readonly remainingAttempts: 0; readonly lockedUntil: Date }}
 */
export type PasswordFailure =
  | {
      readonly lockout: PasswordLockout;
      readonly remainingAttempts: number;
      readonly lockedUntil: null;
    }
  | {
      readonly lockout: PasswordLockout;
      readonly remainingAttempts: 0;
      readonly lockedUntil: Date;
    };
