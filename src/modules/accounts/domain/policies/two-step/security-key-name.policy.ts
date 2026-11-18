import { InvalidSecurityKeyNameError } from '../../errors/two-step/invalid-security-key-name.error.js';
import { TWO_STEP_LIMITS } from './two-step-limits.policy.js';

/**
 * Function normalizeSecurityKeyName
 *
 * @description
 * The name of a security key, trimmed ("Trimmed here; a name made only of spaces answers
 * `400 request.invalid`", `SecurityKeyAddition.name` of the contract), 1 to 60 characters.
 *
 * @param {string} name - The name as typed.
 * @returns {string} The trimmed name.
 * @throws {InvalidSecurityKeyNameError} For an empty or too long name.
 */
export function normalizeSecurityKeyName(name: string): string {
  const trimmed: string = name.trim();
  const length: number = Array.from(trimmed).length;
  if (length === 0 || length > TWO_STEP_LIMITS.securityKeyNameMaxLength) {
    throw new InvalidSecurityKeyNameError();
  }
  return trimmed;
}
