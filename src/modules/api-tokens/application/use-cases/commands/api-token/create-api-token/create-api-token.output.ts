import type { ApiTokenView } from '../../../../projections/api-token/api-token-view.projection.js';

/**
 * Interface CreateApiTokenOutput
 *
 * @description
 * The new token and its secret, which exists here only (`ApiTokenCreated` of the contract).
 */
export interface CreateApiTokenOutput {
  // #region Properties
  /**
   * Property apiToken
   *
   * @description
   * The token.
   *
   * @type {ApiTokenView}
   * @readonly
   */
  readonly apiToken: ApiTokenView;

  /**
   * Property secret
   *
   * @description
   * The secret, returned once. Never logged, never stored.
   *
   * @type {string}
   * @readonly
   */
  readonly secret: string;
  // #endregion
}
