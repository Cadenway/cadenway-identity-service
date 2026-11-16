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
