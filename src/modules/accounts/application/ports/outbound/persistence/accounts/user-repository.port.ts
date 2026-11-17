import type { UserRegistration } from '../../../../../domain/aggregates/account/user-registration.aggregate.js';
import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { DueAccountDeletion } from '../../../../models/deletion/due-account-deletion.model.js';

/**
 * Interface UserRepository
 *
 * @description
 * The accounts, bound to the transaction of a unit of work. An account belongs to no organization:
 * every read names the account by its id or its normalized address.
 */
export interface UserRepository {
  // #region Methods
  /**
   * Method findByEmail
   *
   * @description
   * Loads the account of an address, locking its row until the end of the transaction when
   * `forUpdate` is set.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {boolean} forUpdate - Whether to lock the row for a change.
   * @returns {Promise<User | null>} The account, or `null` when none uses the address.
   */
  findByEmail(email: EmailAddress, forUpdate: boolean): Promise<User | null>;

  /**
   * Method findById
   *
   * @description
   * Loads an account by its id.
   *
   * @param {string} id - Id of the account.
   * @returns {Promise<User | null>} The account, or `null` when the id is unknown.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Method lock
   *
   * @description
   * Loads an account by its id and locks its row until the end of the transaction.
   *
   * @param {string} id - Id of the account.
   * @returns {Promise<User | null>} The account, or `null` when the id is unknown.
   */
  lock(id: string): Promise<User | null>;

  /**
   * Method insert
   *
   * @description
   * Stores a new account; PostgreSQL assigns its id.
   *
   * @param {UserRegistration} registration - The account to create.
   * @returns {Promise<User>} The stored account, with its id.
   */
  insert(registration: UserRegistration): Promise<User>;

  /**
   * Method update
   *
   * @description
   * Writes a changed account (name, profile, verification, version, sign-up count) whose stored
   * version is the one before `user.version`.
   *
   * @param {User} user - The account after the change.
   * @returns {Promise<void>} Resolves once written.
   * @throws {Error} When the stored version moved meanwhile: a defect, since the row is locked.
   */
  update(user: User): Promise<void>;

  /**
   * Method findDueDeletions
   *
   * @description
   * Claims the accounts whose scheduled deletion is due at `now` and that were not checked since
   * `checkedBefore`, the oldest first, skipping the rows another transaction holds.
   *
   * @param {Date} now - The instant of the sweep.
   * @param {Date} checkedBefore - Accounts checked since then are left for a later sweep.
   * @param {number} limit - Accounts claimed at most.
   * @returns {Promise<DueAccountDeletion[]>} The claimed accounts.
   */
  findDueDeletions(now: Date, checkedBefore: Date, limit: number): Promise<DueAccountDeletion[]>;

  /**
   * Method markDeletionChecked
   *
   * @description
   * Records that a due deletion was checked and kept, so that the sweep claims it again later.
   *
   * @param {string} userId - The account.
   * @param {Date} now - When it was checked.
   * @returns {Promise<void>} Resolves once written.
   */
  markDeletionChecked(userId: string, now: Date): Promise<void>;

  /**
   * Method delete
   *
   * @description
   * Deletes an account at the version it was locked at; its password, codes, reset links and
   * pending change of address go with it.
   *
   * @param {User} user - The locked account.
   * @returns {Promise<void>} Resolves once deleted.
   * @throws {Error} When the stored version moved meanwhile: a defect, since the row is locked.
   */
  delete(user: User): Promise<void>;
  // #endregion
}
