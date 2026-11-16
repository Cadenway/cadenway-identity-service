import type { CodeSubject } from '../../../../models/authentication/code-subject.model.js';

/**
 * Interface OneTimeCodeSecrets
 *
 * @description
 * Draws the codes and hashes them with a key kept outside the database: six digits are a million
 * values, so an unkeyed hash would give them back from a copy of the table.
 */
export interface OneTimeCodeSecrets {
  // #region Methods
  /**
   * Method generate
   *
   * @description
   * Draws a code of 6 digits, uniformly, from a cryptographic source.
   *
   * @returns {string} The code, leading zeros kept.
   */
  generate(): string;

  /**
   * Method hash
   *
   * @description
   * The keyed hash of a code for an account and a purpose, as hexadecimal.
   *
   * @param {CodeSubject} subject - The code and what it is for.
   * @returns {string} The hash to store or to compare.
   */
  hash(subject: CodeSubject): string;
  // #endregion
}
