import type { SignInChallengeIssue } from './sign-in-challenge-issue.aggregate.js';

/**
 * Interface SignInChallengeState
 *
 * @description
 * A stored two-step challenge (`sign_in_challenges`), with the WebAuthn challenge of its latest
 * security-key options.
 */
export interface SignInChallengeState extends SignInChallengeIssue {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the challenge.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property assertionChallenge
   *
   * @description
   * The WebAuthn challenge of the latest security-key options (base64url), or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly assertionChallenge: string | null;

  /**
   * Property assertionExpiresAt
   *
   * @description
   * When those options stop working, 5 minutes after they were issued, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly assertionExpiresAt: Date | null;
  // #endregion
}
