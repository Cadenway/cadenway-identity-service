import type { ApiTokenPosition } from '../../../../models/api-token/api-token-position.model.js';

/**
 * Interface ListApiTokensInput
 *
 * @description
 * Which page of the tokens of the actor in the organization of its internal token.
 */
export interface ListApiTokensInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The user of the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property organizationId
   *
   * @description
   * The organization of the verified internal token.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property after
   *
   * @description
   * Where the page starts, from the cursor of the previous one; `null` for the first.
   *
   * @type {ApiTokenPosition | null}
   * @readonly
   */
  readonly after: ApiTokenPosition | null;

  /**
   * Property limit
   *
   * @description
   * Page size, 1 to 100.
   *
   * @type {number}
   * @readonly
   */
  readonly limit: number;
  // #endregion
}
