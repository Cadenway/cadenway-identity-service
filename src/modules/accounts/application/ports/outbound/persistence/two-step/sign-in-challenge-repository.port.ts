import type { SignInChallengeIssue } from '../../../../../domain/aggregates/two-step/sign-in-challenge-issue.aggregate.js';
import type { SignInChallenge } from '../../../../../domain/aggregates/two-step/sign-in-challenge.aggregate.js';

/**
 * Interface SignInChallengeRepository
 *
 * @description
 * The open two-step challenges of the accounts (`sign_in_challenges`), one per account, known by
 * the SHA-256 of their token.
 */
export interface SignInChallengeRepository {
  // #region Methods
  /**
   * Method replace
   *
   * @description
   * Stores the new challenge of an account in place of the previous one, which stops working.
   *
   * @param {SignInChallengeIssue} issue - The new challenge.
   * @returns {Promise<SignInChallenge>} The stored challenge.
   */
  replace(issue: SignInChallengeIssue): Promise<SignInChallenge>;

  /**
   * Method findByTokenHash
   *
   * @description
   * A challenge by the hash of its token, locked until the end of the transaction when asked.
   *
   * @param {string} tokenHash - The SHA-256 of the token.
   * @param {boolean} forUpdate - Whether to lock it.
   * @returns {Promise<SignInChallenge | null>} The challenge, or `null` for an unknown, answered or replaced one.
   */
  findByTokenHash(tokenHash: string, forUpdate: boolean): Promise<SignInChallenge | null>;

  /**
   * Method saveAssertion
   *
   * @description
   * Stores the WebAuthn challenge of the latest security-key options of a challenge.
   *
   * @param {SignInChallenge} challenge - The challenge with its options.
   * @returns {Promise<void>} Resolves once written.
   */
  saveAssertion(challenge: SignInChallenge): Promise<void>;

  /**
   * Method deleteOfUser
   *
   * @description
   * Ends the open challenge of an account: its right answer, a password change or reset, turning
   * two-step verification off.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  deleteOfUser(userId: string): Promise<void>;
  // #endregion
}
