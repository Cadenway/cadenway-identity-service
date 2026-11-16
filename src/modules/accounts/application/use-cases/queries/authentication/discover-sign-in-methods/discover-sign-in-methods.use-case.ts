import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { DiscoverSignInMethodsInput } from './discover-sign-in-methods.input.js';
import type { SignInMethodsView } from './discover-sign-in-methods.output.js';

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
