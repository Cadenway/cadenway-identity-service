import type { PendingTwoStepStart } from '../../../../../domain/value-objects/two-step/pending-two-step-start.value-object.js';

/**
 * Interface PendingTwoStepRepository
 *
 * @description
 * The started changes of two-step verification of the accounts: the pending setup of an app
 * (`authenticator_app_setups`) and the pending registration of a key
 * (`security_key_registrations`), one each per account.
 */
export interface PendingTwoStepRepository {
  // #region Methods
  /**
   * Method putSetup
   *
   * @description
   * Records the pending setup of an app, replacing the previous one.
   *
   * @param {string} userId - The account.
   * @param {PendingTwoStepStart} pending - The session, the sealed secret and the expiry.
   * @returns {Promise<void>} Resolves once written.
   */
  putSetup(userId: string, pending: PendingTwoStepStart): Promise<void>;

  /**
   * Method findSetup
   *
   * @description
   * The pending setup of an app of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<PendingTwoStepStart | null>} It, or `null`.
   */
  findSetup(userId: string): Promise<PendingTwoStepStart | null>;

  /**
   * Method putRegistration
   *
   * @description
   * Records the pending registration of a key, replacing the previous one.
   *
   * @param {string} userId - The account.
   * @param {PendingTwoStepStart} pending - The session, the WebAuthn challenge and the expiry.
   * @returns {Promise<void>} Resolves once written.
   */
  putRegistration(userId: string, pending: PendingTwoStepStart): Promise<void>;

  /**
   * Method findRegistration
   *
   * @description
   * The pending registration of a key of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<PendingTwoStepStart | null>} It, or `null`.
   */
  findRegistration(userId: string): Promise<PendingTwoStepStart | null>;

  /**
   * Method deleteSetup
   *
   * @description
   * Ends the pending setup of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  deleteSetup(userId: string): Promise<void>;

  /**
   * Method deleteRegistration
   *
   * @description
   * Ends the pending registration of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  deleteRegistration(userId: string): Promise<void>;

  /**
   * Method dropOfOtherSessions
   *
   * @description
   * Ends the pending setup and registration of an account that belong to another session than this
   * one, as a change of password does.
   *
   * @param {string} userId - The account.
   * @param {string} sessionId - The session they may belong to.
   * @returns {Promise<void>} Resolves once deleted.
   */
  dropOfOtherSessions(userId: string, sessionId: string): Promise<void>;

  /**
   * Method dropOfUser
   *
   * @description
   * Ends every pending setup and registration of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  dropOfUser(userId: string): Promise<void>;
  // #endregion
}
