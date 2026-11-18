/**
 * Interface RequestEmailChangeInput
 *
 * @description
 * A request to change the address of the account ("Modifier l'adresse e-mail",
 * `POST /v1/me/email-change`).
 */
export interface RequestEmailChangeInput {
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
   * The session of the request, whose recent authentication is checked and to which the change
   * belongs.
   *
   * @type {string}
   * @readonly
   */
  readonly sessionId: string;

  /**
   * Property email
   *
   * @description
   * The new address, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}
