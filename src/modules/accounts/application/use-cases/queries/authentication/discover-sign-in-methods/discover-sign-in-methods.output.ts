import type { SignInMethodType } from '../../../../models/authentication/sign-in-method-type.model.js';

/**
 * Interface SignInMethodsView
 *
 * @description
 * The methods offered for an address, in the order to show them (`SignInMethods`).
 */
export interface SignInMethodsView {
  // #region Properties
  /**
   * Property methods
   *
   * @description
   * The methods, in order.
   *
   * @type {readonly { readonly type: SignInMethodType }[]}
   * @readonly
   */
  readonly methods: readonly { readonly type: SignInMethodType }[];
  // #endregion
}
