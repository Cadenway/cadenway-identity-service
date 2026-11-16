import { PasswordTooShortError } from '../../errors/password/password-too-short.error.js';

/**
 * Constant PASSWORD_MIN_LENGTH
 *
 * @description
 * Fewest Unicode code points a password may have (`details.minLength` of
 * `auth.password-too-short`).
 *
 * @type {number}
 */
export const PASSWORD_MIN_LENGTH: number = 12;

/**
 * Function assertAcceptablePassword
 *
 * @description
 * What a new password must satisfy. Source: the `cw-identity-security` skill and decision 4 of the
 * walking skeleton, written into `openapi/public/auth.yaml` (`Password`): 12 characters at least,
 * counted as Unicode code points, and no composition rule. This decision overrides the password
 * screens of the mockup, which still list composition rules. The check against the list of
 * compromised passwords is not a domain rule: the list sits behind a port of the application.
 *
 * @param {string} password - The password as typed; never logged, never kept.
 * @throws {PasswordTooShortError} When it has fewer than 12 code points.
 */
export function assertAcceptablePassword(password: string): void {
  if (Array.from(password).length < PASSWORD_MIN_LENGTH) {
    throw new PasswordTooShortError(PASSWORD_MIN_LENGTH);
  }
}
