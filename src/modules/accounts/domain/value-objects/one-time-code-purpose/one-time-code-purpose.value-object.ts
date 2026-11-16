/**
 * Type OneTimeCodePurpose
 *
 * @description
 * What a code proves (`purpose` of `one-time-code.issued.v1`): the address of a sign-up, a sign-in
 * without a password, or a new address. `email-change` is declared by the contract and has no
 * route yet.
 *
 * @type {'email-verification' | 'sign-in' | 'email-change'}
 */
export type OneTimeCodePurpose = 'email-verification' | 'sign-in' | 'email-change';

/**
 * Constant ONE_TIME_CODE_PURPOSES
 *
 * @description
 * Every purpose, in the order of the contract; the `CHECK` constraint of the table lists the same.
 *
 * @type {readonly OneTimeCodePurpose[]}
 */
export const ONE_TIME_CODE_PURPOSES: readonly OneTimeCodePurpose[] = [
  'email-verification',
  'sign-in',
  'email-change',
];
