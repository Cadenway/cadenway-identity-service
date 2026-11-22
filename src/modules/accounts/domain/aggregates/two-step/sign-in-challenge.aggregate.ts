import { InvalidTwoStepStateError } from '../../errors/two-step/invalid-two-step-state.error.js';
import type { FederatedChallengeBinding } from '../../value-objects/federated-sign-in/federated-challenge-binding.value-object.js';
import type { SignInChallengeIssue } from './sign-in-challenge-issue.aggregate.js';
import type { SignInChallengeState } from './sign-in-challenge-state.aggregate.js';

/**
 * Class SignInChallenge
 *
 * @description
 * The two-step challenge a sign-in of an account with two-step verification answers `202` with
 * ("Vérification en deux étapes", `SignInChallenge` of the contract). One per account: a new
 * sign-in replaces it, its right answer uses it up. It is usable 10 minutes; its security-key
 * options, which a new request replaces, are usable 5 minutes.
 */
export class SignInChallenge {
  // #region Properties
  /**
   * Property LIFETIME_MS
   *
   * @description
   * Lifetime of a challenge, 10 minutes (`expiresAt` of the contract).
   *
   * @type {number}
   * @readonly
   */
  public static readonly LIFETIME_MS: number = 10 * 60_000;

  /**
   * Property ASSERTION_LIFETIME_MS
   *
   * @description
   * Lifetime of the WebAuthn options of a challenge, 5 minutes.
   *
   * @type {number}
   * @readonly
   */
  public static readonly ASSERTION_LIFETIME_MS: number = 5 * 60_000;

  /**
   * Property state
   *
   * @description
   * The stored state.
   *
   * @type {SignInChallengeState}
   * @readonly
   */
  private readonly state: SignInChallengeState;

  /**
   * Property id
   *
   * @description
   * Id of the challenge.
   *
   * @type {string}
   */
  public get id(): string {
    return this.state.id;
  }

  /**
   * Property userId
   *
   * @description
   * The account of the challenge.
   *
   * @type {string}
   */
  public get userId(): string {
    return this.state.userId;
  }

  /**
   * Property persistent
   *
   * @description
   * The `rememberMe` of the sign-in.
   *
   * @type {boolean}
   */
  public get persistent(): boolean {
    return this.state.persistent;
  }

  /**
   * Property expiresAt
   *
   * @description
   * When the challenge stops working.
   *
   * @type {Date}
   */
  public get expiresAt(): Date {
    return this.state.expiresAt;
  }

  /**
   * Property snapshot
   *
   * @description
   * The state, for the repository.
   *
   * @type {SignInChallengeState}
   */
  public get snapshot(): SignInChallengeState {
    return this.state;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Wraps a stored state; use `restore`.
   *
   * @param {SignInChallengeState} state - The state.
   * @constructor
   */
  private constructor(state: SignInChallengeState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method issue
   *
   * @description
   * A new challenge after a right first factor, usable 10 minutes.
   *
   * @param {string} userId - The account.
   * @param {string} tokenHash - The SHA-256 of its token.
   * @param {boolean} persistent - The `rememberMe` of the sign-in.
   * @param {Date} now - The instant of the sign-in.
   * @param {FederatedChallengeBinding | null} federatedBinding - The federated first-factor authority.
   * @returns {SignInChallengeIssue} The challenge to store.
   */
  public static issue(
    userId: string,
    tokenHash: string,
    persistent: boolean,
    now: Date,
    federatedBinding: FederatedChallengeBinding | null = null,
  ): SignInChallengeIssue {
    return {
      userId,
      tokenHash,
      persistent,
      expiresAt: new Date(now.getTime() + SignInChallenge.LIFETIME_MS),
      federatedBinding,
    };
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored challenge.
   *
   * @param {SignInChallengeState} state - The stored state.
   * @returns {SignInChallenge} The challenge.
   * @throws {InvalidTwoStepStateError} For an assertion challenge without its expiry, or the
   * reverse.
   */
  public static restore(state: SignInChallengeState): SignInChallenge {
    if ((state.assertionChallenge === null) !== (state.assertionExpiresAt === null)) {
      throw new InvalidTwoStepStateError('an assertion challenge comes with its expiry');
    }
    return new SignInChallenge(state);
  }

  /**
   * Method isUsableAt
   *
   * @description
   * Whether the challenge can still be read or answered; an expired one answers
   * `auth.challenge-expired` and counts nothing.
   *
   * @param {Date} now - The instant of the request.
   * @returns {boolean} `true` before `expiresAt`.
   */
  public isUsableAt(now: Date): boolean {
    return now.getTime() < this.state.expiresAt.getTime();
  }

  /**
   * Method withAssertion
   *
   * @description
   * Records the WebAuthn challenge of new security-key options, replacing the previous ones.
   *
   * @param {string} assertionChallenge - The WebAuthn challenge (base64url).
   * @param {Date} now - The instant of the options.
   * @returns {SignInChallenge} The challenge to save.
   */
  public withAssertion(assertionChallenge: string, now: Date): SignInChallenge {
    return new SignInChallenge({
      ...this.state,
      assertionChallenge,
      assertionExpiresAt: new Date(now.getTime() + SignInChallenge.ASSERTION_LIFETIME_MS),
    });
  }

  /**
   * Method assertionChallengeAt
   *
   * @description
   * The WebAuthn challenge a key answer must sign at an instant: `null` without options or once
   * they expired, which refuses the answer.
   *
   * @param {Date} now - The instant of the answer.
   * @returns {string | null} The WebAuthn challenge, or `null`.
   */
  public assertionChallengeAt(now: Date): string | null {
    const expiresAt: Date | null = this.state.assertionExpiresAt;
    return expiresAt !== null && now.getTime() < expiresAt.getTime()
      ? this.state.assertionChallenge
      : null;
  }
  // #endregion
}
