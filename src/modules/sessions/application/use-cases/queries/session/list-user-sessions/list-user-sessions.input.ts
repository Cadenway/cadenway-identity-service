import type { SessionPosition } from '../../../../models/session/session-position.model.js';

/**
 * Interface ListUserSessionsInput
 *
 * @description
 * A page of "Sessions actives" (`GET /internal/v1/users/{userId}/sessions`).
 */
export interface ListUserSessionsInput {
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
   * Property currentSessionId
   *
   * @description
   * The session of the request, marked `current`.
   *
   * @type {string}
   * @readonly
   */
  readonly currentSessionId: string;

  /**
   * Property after
   *
   * @description
   * The end of the previous page, or `null` for the first.
   *
   * @type {SessionPosition | null}
   * @readonly
   */
  readonly after: SessionPosition | null;

  /**
   * Property limit
   *
   * @description
   * Sessions of the page at most.
   *
   * @type {number}
   * @readonly
   */
  readonly limit: number;
  // #endregion
}
