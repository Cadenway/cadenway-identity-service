/**
 * Interface UpdateUserProfileInput
 *
 * @description
 * Who changes which profile, from which version, with which merge patch
 * (`PATCH /internal/v1/users/{userId}`).
 */
export interface UpdateUserProfileInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The user of the verified internal token, never a value of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property userId
   *
   * @description
   * The account of the path.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property expectedVersions
   *
   * @description
   * The versions `If-Match` accepts, or `null` without a condition (no header, or `*`).
   *
   * @type {readonly number[] | null}
   * @readonly
   */
  readonly expectedVersions: readonly number[] | null;

  /**
   * Property patch
   *
   * @description
   * The members to change: a member left out is kept, `null` clears `displayName` or `jobTitle`.
   *
   * @type {{ readonly name?: string; readonly displayName?: string | null; readonly jobTitle?: string | null; readonly timeZone?: string; readonly language?: string }}
   * @readonly
   */
  readonly patch: {
    readonly name?: string;
    readonly displayName?: string | null;
    readonly jobTitle?: string | null;
    readonly timeZone?: string;
    readonly language?: string;
  };
  // #endregion
}
