/**
 * Interface UpdateAuthenticationPolicyInput
 *
 * @description
 * A JSON Merge Patch of the authentication policy of the organization of the internal token (`PATCH
 * /internal/v1/organization/authentication-policy`).
 */
export interface UpdateAuthenticationPolicyInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The actor, from the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property organizationId
   *
   * @description
   * The organization of the internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the public request, whose recent authentication is checked.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property expectedVersions
   *
   * @description
   * The versions of `If-Match`, or `null` without the header or with `*`.
   *
   * @type {readonly number[] | null}
   * @readonly
   */
  readonly expectedVersions: readonly number[] | null;

  /**
   * Property twoStepVerificationRequiredFor
   *
   * @description
   * The new roles that must have two-step verification.
   *
   * @type {'nobody' | 'admins' | 'everyone' | undefined}
   * @readonly
   */
  readonly twoStepVerificationRequiredFor?: 'nobody' | 'admins' | 'everyone';

  /**
   * Property sessionInactivityTimeoutMinutes
   *
   * @description
   * The new inactivity of the sessions, in minutes.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly sessionInactivityTimeoutMinutes?: number;
  // #endregion
}
