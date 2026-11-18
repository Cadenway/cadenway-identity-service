import type { TwoStepVerification } from './two-step-verification.aggregate.js';

/**
 * Type TwoStepFailure
 *
 * @description
 * A wrong two-step answer counted: the two-step verification to save, and either the answers left
 * before the lockout (`remainingAttempts` from 4 to 1) or the end of the lockout the fifth one
 * starts.
 *
 * @type {{ readonly verification: TwoStepVerification; readonly remainingAttempts: number; readonly lockedUntil: null } | { readonly verification: TwoStepVerification; readonly remainingAttempts: 0; readonly lockedUntil: Date }}
 */
export type TwoStepFailure =
  | {
      readonly verification: TwoStepVerification;
      readonly remainingAttempts: number;
      readonly lockedUntil: null;
    }
  | {
      readonly verification: TwoStepVerification;
      readonly remainingAttempts: 0;
      readonly lockedUntil: Date;
    };
