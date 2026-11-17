import { DomainError } from './domain.error.js';

/**
 * Class InvalidProfileError
 *
 * @description
 * A member of a profile patch that breaks a rule: a display name or a job title empty once trimmed
 * or too long, a time zone or a language that is empty or too long. The HTTP schema refuses them
 * before the use case, so here it is a defect.
 */
export class InvalidProfileError extends DomainError {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the member without quoting its value.
   *
   * @param {string} member - The refused member of the profile.
   * @constructor
   */
  public constructor(member: string) {
    super(`The ${member} of the profile breaks its rule.`);
  }
  // #endregion
}
