import { InvalidAuthenticationPolicyError } from '../../errors/authentication-policy/invalid-authentication-policy.error.js';
import type { AuthenticationPolicyPatch } from '../../value-objects/authentication-policy/authentication-policy-patch.value-object.js';
import type { AuthenticationPolicyState } from '../../value-objects/authentication-policy/authentication-policy-state.value-object.js';
import type { TwoStepRequiredFor } from '../../value-objects/authentication-policy/two-step-required-for.value-object.js';

/**
 * Class AuthenticationPolicy
 *
 * @description
 * The authentication policy of an organization ("Politique d'authentification" of
 * Organisation.dc.html, decision 8 of P2c, `AuthenticationPolicy` of the contract), which this
 * service keeps and applies:
 *
 * - who must have two-step verification to act on the organization: `nobody` (the default),
 *   `admins` (the owner and the admins) or `everyone` (guests included);
 * - the inactivity after which the sessions acting on it close: 1 hour, 12 hours (the default),
 *   7 days or 30 days;
 * - a member who must have two-step verification and has none keeps their session but gets no
 *   context in the organization (the organization is withheld);
 * - a change that moves something takes the next version; the default policy is version 1.
 */
export class AuthenticationPolicy {
  // #region Properties
  /**
   * Property INACTIVITY_TIMEOUTS_MINUTES
   *
   * @description
   * The inactivities the contract allows, in minutes ("1 heure", "12 heures", "7 jours", "30 jours").
   *
   * @type {readonly number[]}
   * @readonly
   */
  public static readonly INACTIVITY_TIMEOUTS_MINUTES: readonly number[] = [60, 720, 10_080, 43_200];

  /**
   * Property DEFAULT_INACTIVITY_TIMEOUT_MINUTES
   *
   * @description
   * The inactivity of the default policy: 12 hours, in minutes.
   *
   * @type {number}
   * @readonly
   */
  public static readonly DEFAULT_INACTIVITY_TIMEOUT_MINUTES: number = 720;

  /**
   * Property state
   *
   * @description
   * The state of the policy; a change returns a new policy.
   *
   * @type {AuthenticationPolicyState}
   * @readonly
   */
  private readonly state: AuthenticationPolicyState;

  /**
   * Property snapshot
   *
   * @description
   * The state to store or to answer.
   *
   * @type {AuthenticationPolicyState}
   * @readonly
   */
  public get snapshot(): AuthenticationPolicyState {
    return this.state;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps a checked state.
   *
   * @param {AuthenticationPolicyState} state - The checked state.
   * @constructor
   */
  private constructor(state: AuthenticationPolicyState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method defaultFor
   *
   * @description
   * The policy of an organization that never changed it: nobody must have two-step verification,
   * 12 hours of inactivity, version 1.
   *
   * @param {string} organizationId - The organization.
   * @returns {AuthenticationPolicy} The default policy.
   */
  public static defaultFor(organizationId: string): AuthenticationPolicy {
    return new AuthenticationPolicy({
      organizationId,
      twoStepVerificationRequiredFor: 'nobody',
      sessionInactivityTimeoutMinutes: AuthenticationPolicy.DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
      version: 1,
    });
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored policy.
   *
   * @param {AuthenticationPolicyState} state - The stored state.
   * @returns {AuthenticationPolicy} The policy.
   * @throws {InvalidAuthenticationPolicyError} For a value the contract does not list.
   */
  public static restore(state: AuthenticationPolicyState): AuthenticationPolicy {
    AuthenticationPolicy.assertValues(
      state.twoStepVerificationRequiredFor,
      state.sessionInactivityTimeoutMinutes,
    );
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InvalidAuthenticationPolicyError('the version is a positive integer');
    }
    return new AuthenticationPolicy(state);
  }

  /**
   * Method assertValues
   *
   * @description
   * Refuses a role group or an inactivity outside the contract.
   *
   * @param {string} requiredFor - The role group.
   * @param {number} inactivityMinutes - The inactivity, in minutes.
   * @throws {InvalidAuthenticationPolicyError} For an unknown value.
   */
  private static assertValues(requiredFor: string, inactivityMinutes: number): void {
    if (!['nobody', 'admins', 'everyone'].includes(requiredFor)) {
      throw new InvalidAuthenticationPolicyError('the roles are nobody, admins or everyone');
    }
    if (!AuthenticationPolicy.INACTIVITY_TIMEOUTS_MINUTES.includes(inactivityMinutes)) {
      throw new InvalidAuthenticationPolicyError(
        'the inactivity is 60, 720, 10080 or 43200 minutes',
      );
    }
  }

  /**
   * Method requiresTwoStepFor
   *
   * @description
   * Whether the policy requires two-step verification of a member of this role: every role for
   * `everyone`, the owner and the admins for `admins`, none for `nobody`.
   *
   * @param {'owner' | 'admin' | 'member' | 'guest'} role - The role of the member.
   * @returns {boolean} `true` when the member must have two-step verification.
   */
  public requiresTwoStepFor(role: 'owner' | 'admin' | 'member' | 'guest'): boolean {
    const requiredFor: TwoStepRequiredFor = this.state.twoStepVerificationRequiredFor;
    return (
      requiredFor === 'everyone' || (requiredFor === 'admins' && ['owner', 'admin'].includes(role))
    );
  }

  /**
   * Method withholds
   *
   * @description
   * Whether the organization is withheld from a member: the policy requires two-step verification
   * for their role and their account has none ("Withheld organization" of the internal contract).
   *
   * @param {'owner' | 'admin' | 'member' | 'guest'} role - The role of the member.
   * @param {boolean} twoStepVerificationEnabled - Whether their account has two-step verification.
   * @returns {boolean} `true` when the organization gives them no context.
   */
  public withholds(
    role: 'owner' | 'admin' | 'member' | 'guest',
    twoStepVerificationEnabled: boolean,
  ): boolean {
    return !twoStepVerificationEnabled && this.requiresTwoStepFor(role);
  }

  /**
   * Method apply
   *
   * @description
   * Applies a JSON Merge Patch: a member left out is unchanged; a patch that moves nothing returns
   * this policy, with the same version; otherwise the next version.
   *
   * @param {AuthenticationPolicyPatch} patch - The patch, validated by the contract.
   * @returns {AuthenticationPolicy} The policy after the patch.
   * @throws {InvalidAuthenticationPolicyError} For a value the contract does not list.
   */
  public apply(patch: AuthenticationPolicyPatch): AuthenticationPolicy {
    const requiredFor: TwoStepRequiredFor =
      patch.twoStepVerificationRequiredFor ?? this.state.twoStepVerificationRequiredFor;
    const inactivity: number =
      patch.sessionInactivityTimeoutMinutes ?? this.state.sessionInactivityTimeoutMinutes;
    AuthenticationPolicy.assertValues(requiredFor, inactivity);
    if (
      requiredFor === this.state.twoStepVerificationRequiredFor &&
      inactivity === this.state.sessionInactivityTimeoutMinutes
    ) {
      return this;
    }
    return new AuthenticationPolicy({
      ...this.state,
      twoStepVerificationRequiredFor: requiredFor,
      sessionInactivityTimeoutMinutes: inactivity,
      version: this.state.version + 1,
    });
  }
  // #endregion
}
