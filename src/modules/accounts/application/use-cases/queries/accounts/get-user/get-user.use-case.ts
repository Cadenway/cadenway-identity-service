import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { toAccountView } from '../../../../mappers/accounts/account-view.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { AccountView } from '../../../../projections/accounts/account-view.projection.js';
import type { GetUserInput } from './get-user.input.js';

/**
 * Class GetUser
 *
 * @description
 * Reads an account (`GET /internal/v1/users/{userId}`). A user reads its own account only: another
 * id, or an unknown one, answers `user.not-found`, so the answer never tells whether an id exists.
 */
export class GetUser {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The read-only transaction of the query.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the transaction port.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The read-only transaction of the query.
   * @constructor
   */
  public constructor(unitOfWork: AccountsUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads the account of the actor.
   *
   * @param {GetUserInput} input - The actor and the account.
   * @returns {Promise<AccountView>} The account.
   * @throws {AccountRefusal} `user.not-found` for another or an unknown account.
   */
  public async execute(input: GetUserInput): Promise<AccountView> {
    if (input.actorUserId !== input.userId) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    const user: User | null = await this.unitOfWork.run(
      (store: AccountsStore): Promise<User | null> => store.users.findById(input.userId),
      { readOnly: true },
    );
    if (user === null) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    return toAccountView(user);
  }
  // #endregion
}
