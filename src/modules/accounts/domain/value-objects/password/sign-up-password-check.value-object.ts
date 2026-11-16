/**
 * Type SignUpPasswordCheck
 *
 * @description
 * What a verification with the right code says of the password of the latest sign-up
 * (`SignUpVerification.password` of the contract): the `password` it sent `matches` that password
 * or `differs` from it, or it sent none (`not-sent`).
 *
 * @type {'matches' | 'differs' | 'not-sent'}
 */
export type SignUpPasswordCheck = 'matches' | 'differs' | 'not-sent';
