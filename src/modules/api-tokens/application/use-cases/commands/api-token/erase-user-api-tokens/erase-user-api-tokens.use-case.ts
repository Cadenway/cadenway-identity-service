import type { ApiTokenRepository } from '../../../../ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { ApiTokensUnitOfWork } from '../../../../ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import type { EraseUserApiTokensInput } from './erase-user-api-tokens.input.js';

/**
 * Class EraseUserApiTokens
 *
 * @description
 * Deletes every personal API token of a deleted account, in every organization (`user.deleted.v1`,
 * decision 9 of P2c). They were revoked when the deletion was scheduled. Runs in the system
 * transaction of the deletion and joins it: the system access lifts the policy of `api_tokens` for
 * the rows of this account only, named by `user_id`.
 */
export class EraseUserApiTokens {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction, joined to the one of the caller.
   *
   * @type {ApiTokensUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: ApiTokensUnitOfWork;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the transaction.
   *
   * @param {ApiTokensUnitOfWork} unitOfWork - The system transaction.
   * @constructor
   */
  public constructor(unitOfWork: ApiTokensUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Erases the tokens.
   *
   * @param {EraseUserApiTokensInput} input - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  public async execute(input: EraseUserApiTokensInput): Promise<void> {
    await this.unitOfWork.run((tokens: ApiTokenRepository): Promise<void> =>
      tokens.eraseOfUser(input.userId),
    );
  }
  // #endregion
}
