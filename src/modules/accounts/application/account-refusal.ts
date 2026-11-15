/**
 * Type Refusal
 *
 * @description
 * Why a use case of the accounts module refused, with the values the contract puts in `details`.
 * Each reason is one stable `code` of `openapi/internal/identity-service.yaml` (`auth.<reason>`,
 * `user.not-found`); the HTTP adapter maps it, the use case never knows a status.
 *
 * @type {{ readonly reason: 'terms-not-accepted' | 'password-compromised' | 'email-taken' | 'code-invalid' | 'code-expired' | 'email-not-verified' | 'user-not-found' } | { readonly reason: 'password-too-short'; readonly minLength: number } | { readonly reason: 'code-throttled'; readonly resendAvailableAt: Date } | { readonly reason: 'invalid-credentials'; readonly remainingAttempts: number } | { readonly reason: 'account-locked'; readonly lockedUntil: Date }}
 */
export type Refusal =
  | {
      readonly reason:
        | 'terms-not-accepted'
        | 'password-compromised'
        | 'email-taken'
        | 'code-invalid'
        | 'code-expired'
        | 'email-not-verified'
        | 'user-not-found';
    }
  | { readonly reason: 'password-too-short'; readonly minLength: number }
  | { readonly reason: 'code-throttled'; readonly resendAvailableAt: Date }
  | { readonly reason: 'invalid-credentials'; readonly remainingAttempts: number }
  | { readonly reason: 'account-locked'; readonly lockedUntil: Date };

/**
 * Class AccountRefusal
 *
 * @description
 * Thrown by a use case of the accounts module for an expected refusal of the contract. Its message
 * names the reason only: no address, password or code.
 */
export class AccountRefusal extends Error {
  // #region Properties
  /**
   * Property refusal
   *
   * @description
   * The reason and its details.
   *
   * @type {Refusal}
   * @readonly
   */
  public readonly refusal: Refusal;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Builds the refusal.
   *
   * @param {Refusal} refusal - The reason and its details.
   * @constructor
   */
  public constructor(refusal: Refusal) {
    super(`The request was refused: ${refusal.reason}.`);
    this.name = 'AccountRefusal';
    this.refusal = refusal;
  }
  // #endregion
}
