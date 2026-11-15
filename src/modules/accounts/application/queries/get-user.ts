import type { User } from '../../domain/user.js';
import { AccountRefusal } from '../account-refusal.js';
import { toAccountView } from '../account-views.js';
import type { AccountView } from '../account-views.js';
import type { AccountsStore, AccountsUnitOfWork } from '../ports/accounts-unit-of-work.port.js';

/**
 * Interface GetUserInput
 *
 * @description
 * Who reads which account.
 */
export interface GetUserInput {
  // #region Properties
  /**
   * Property actorUserId
   *
   * @description
   * The user of the verified internal token, never a value of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly actorUserId: string;

  /**
   * Property userId
   *
   * @description
   * The account asked for.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;
  // #endregion
}

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
