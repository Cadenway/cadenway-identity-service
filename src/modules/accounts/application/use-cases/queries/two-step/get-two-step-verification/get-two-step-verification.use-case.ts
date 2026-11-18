import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { TwoStepRequirements } from '../../../../ports/outbound/identity/sessions/two-step-requirements.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { TwoStepVerificationView } from '../../../../projections/two-step/two-step-verification-view.projection.js';
import { toTwoStepVerificationView } from '../../../../services/two-step/two-step-view.service.js';
import type { GetTwoStepVerificationInput } from './get-two-step-verification.input.js';

/**
 * Class GetTwoStepVerification
 *
 * @description
 * Reads the two-step verification of the account of the actor (`GET
 * /internal/v1/users/{userId}/two-step-verification`), with the organizations whose policy requires
 * it, never a secret. Another account, or an unknown one, answers `user.not-found`.
 */
export class GetTwoStepVerification {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the reading.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property requirements
   *
   * @description
   * The policies of the organizations of the account.
   *
   * @type {TwoStepRequirements}
   * @readonly
   */
  private readonly requirements: TwoStepRequirements;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes its ports, bound by the composition of the module.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the reading.
   * @param {TwoStepRequirements} requirements - The policies of the organizations of the account.
   * @constructor
   */
  public constructor(unitOfWork: AccountsUnitOfWork, requirements: TwoStepRequirements) {
    this.unitOfWork = unitOfWork;
    this.requirements = requirements;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads the card.
   *
   * @param {GetTwoStepVerificationInput} input - The actor and the account of the path.
   * @returns {Promise<TwoStepVerificationView>} The card of the account.
   * @throws {AccountRefusal} `user.not-found`.
   */
  public async execute(input: GetTwoStepVerificationInput): Promise<TwoStepVerificationView> {
    if (input.actorUserId !== input.userId) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    return this.unitOfWork.run(async (store: AccountsStore): Promise<TwoStepVerificationView> => {
      if ((await store.users.findById(input.userId)) === null) {
        throw new AccountRefusal({ reason: 'user-not-found' });
      }
      return toTwoStepVerificationView(store, this.requirements, input.userId);
    });
  }
  // #endregion
}
