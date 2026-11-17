/**
 * Interface ScheduleAccountDeletionInput
 *
 * @description
 * A request to delete the account ("Supprimer mon compte", `POST /v1/me/deletion`).
 */
export interface ScheduleAccountDeletionInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The person, from the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property userId
   *
   * @description
   * The account of the path, which must be the actor.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property sessionId
   *
   * @description
   * The session of the request, whose recent authentication is checked; it is revoked too.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;
  // #endregion
}
