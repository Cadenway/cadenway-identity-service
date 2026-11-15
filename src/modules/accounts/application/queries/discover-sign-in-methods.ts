import { EmailAddress } from '../../domain/email-address.js';

/**
 * Type SignInMethodType
 *
 * @description
 * A way to sign in the sign-in screen offers: a password, or a code sent by email. Later versions
 * add other types (`x-extensible-enum` of the contract).
 *
 * @type {'password' | 'email-code'}
 */
export type SignInMethodType = 'password' | 'email-code';

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

/**
 * Interface DiscoverSignInMethodsInput
 *
 * @description
 * The address of the sign-in screen (`SignInMethodsRequest` of the contract).
 */
export interface DiscoverSignInMethodsInput {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address, as typed; it does not change the answer.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}

/**
 * Class DiscoverSignInMethods
 *
 * @description
 * The sign-in methods of an address (`POST /internal/v1/auth/sign-in-methods`): today `password`
 * then `email-code` for every address, whether or not an account uses it, so the answer tells
 * nothing about the address. No data is read.
 */
export class DiscoverSignInMethods {
  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Returns the methods offered for the address.
   *
   * @param {DiscoverSignInMethodsInput} input - The address, as typed.
   * @returns {SignInMethodsView} The methods.
   */
  public execute(input: DiscoverSignInMethodsInput): SignInMethodsView {
    EmailAddress.of(input.email);
    return { methods: [{ type: 'password' }, { type: 'email-code' }] };
  }
  // #endregion
}
