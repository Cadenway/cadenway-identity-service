import type { ApiTokenPosition } from '../../../../models/api-token/api-token-position.model.js';
import type { ApiTokenView } from '../../../../projections/api-token/api-token-view.projection.js';

/**
 * Interface ListApiTokensOutput
 *
 * @description
 * One page of tokens, the most recently created first.
 */
export interface ListApiTokensOutput {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The tokens of the page.
   *
   * @type {readonly ApiTokenView[]}
   * @readonly
   */
  readonly items: readonly ApiTokenView[];

  /**
   * Property next
   *
   * @description
   * Where the next page starts, or `null` on the last page.
   *
   * @type {ApiTokenPosition | null}
   * @readonly
   */
  readonly next: ApiTokenPosition | null;
  // #endregion
}
