import type { SessionPosition } from '../../../../models/session/session-position.model.js';
import type { OpenSessionView } from '../../../../projections/session/open-session-view.projection.js';

/**
 * Interface ListUserSessionsOutput
 *
 * @description
 * One page of the open sessions.
 */
export interface ListUserSessionsOutput {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The sessions of the page.
   *
   * @type {readonly OpenSessionView[]}
   * @readonly
   */
  readonly items: readonly OpenSessionView[];

  /**
   * Property next
   *
   * @description
   * Where the next page starts, or `null` on the last one.
   *
   * @type {SessionPosition | null}
   * @readonly
   */
  readonly next: SessionPosition | null;
  // #endregion
}
