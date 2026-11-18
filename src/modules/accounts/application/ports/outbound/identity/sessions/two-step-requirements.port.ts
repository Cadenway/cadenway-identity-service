import type { TwoStepRequirement } from '../../../../models/two-step/two-step-requirement.model.js';

/**
 * Interface TwoStepRequirements
 *
 * @description
 * The authentication policies of the organizations of an account, which the sessions module owns.
 * The call joins the system transaction of its caller.
 */
export interface TwoStepRequirements {
  // #region Methods
  /**
   * Method of
   *
   * @description
   * The organizations whose policy requires two-step verification for the role of the account in
   * them.
   *
   * @param {string} userId - The account.
   * @returns {Promise<readonly TwoStepRequirement[]>} The requirements, by organization.
   */
  of(userId: string): Promise<readonly TwoStepRequirement[]>;
  // #endregion
}
