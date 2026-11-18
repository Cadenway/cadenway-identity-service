/**
 * Class AuthenticationPolicyRefusal
 *
 * @description
 * Thrown by a route of the authentication policy for a refusal of the contract; the HTTP adapter
 * maps `reason` to its code: `organization.not-found` (404), `organization.role-forbidden` (403),
 * `request.version-mismatch` (412, with the current `version`), `auth.two-step-not-enabled` (409),
 * `auth.reauthentication-required` (403, with the methods) and `session.not-found` (404).
 */
export class AuthenticationPolicyRefusal extends Error {
  // #region Properties
  /**
   * Property reason
   *
   * @description
   * Why the request was refused.
   *
   * @type {'organization-not-found' | 'role-forbidden' | 'version-mismatch' | 'two-step-not-enabled' | 'reauthentication-required' | 'session-not-found'}
   * @readonly
   */
  public readonly reason:
    | 'organization-not-found'
    | 'role-forbidden'
    | 'version-mismatch'
    | 'two-step-not-enabled'
    | 'reauthentication-required'
    | 'session-not-found';

  /**
   * Property version
   *
   * @description
   * The current version of the policy, for a version mismatch.
   *
   * @type {number | null}
   * @readonly
   */
  public readonly version: number | null;

  /**
   * Property twoStepVerificationEnabled
   *
   * @description
   * Whether the actor has two-step verification, which gives the methods of a refused recent
   * authentication.
   *
   * @type {boolean}
   * @readonly
   */
  public readonly twoStepVerificationEnabled: boolean;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Builds the refusal; the message names the reason only.
   *
   * @param {AuthenticationPolicyRefusal['reason']} reason - Why.
   * @param {{ readonly version?: number; readonly twoStepVerificationEnabled?: boolean }} details -
   * The current version, and whether the actor has two-step verification.
   * @constructor
   */
  public constructor(
    reason: AuthenticationPolicyRefusal['reason'],
    details: { readonly version?: number; readonly twoStepVerificationEnabled?: boolean } = {},
  ) {
    super(`The change of the authentication policy was refused: ${reason}.`);
    this.name = 'AuthenticationPolicyRefusal';
    this.reason = reason;
    this.version = details.version ?? null;
    this.twoStepVerificationEnabled = details.twoStepVerificationEnabled ?? false;
  }
  // #endregion
}
