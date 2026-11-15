import type { AccountEvents } from './account-events.port.js';
import type {
  CodeRequestRepository,
  OneTimeCodeRepository,
  PasswordCredentialRepository,
  SignInAttemptRepository,
  UserRepository,
} from './account-repositories.port.js';

/**
 * Interface AccountsStore
 *
 * @description
 * The repositories and the outbox of one transaction.
 */
export interface AccountsStore {
  // #region Properties
  /**
   * Property users
   *
   * @description
   * The accounts.
   *
   * @type {UserRepository}
   * @readonly
   */
  readonly users: UserRepository;

  /**
   * Property credentials
   *
   * @description
   * The password hashes.
   *
   * @type {PasswordCredentialRepository}
   * @readonly
   */
  readonly credentials: PasswordCredentialRepository;

  /**
   * Property codes
   *
   * @description
   * The one-time codes.
   *
   * @type {OneTimeCodeRepository}
   * @readonly
   */
  readonly codes: OneTimeCodeRepository;

  /**
   * Property codeRequests
   *
   * @description
   * The throttle of the code requests.
   *
   * @type {CodeRequestRepository}
   * @readonly
   */
  readonly codeRequests: CodeRequestRepository;

  /**
   * Property signInAttempts
   *
   * @description
   * The password lockouts.
   *
   * @type {SignInAttemptRepository}
   * @readonly
   */
  readonly signInAttempts: SignInAttemptRepository;

  /**
   * Property events
   *
   * @description
   * The outbox of the transaction.
   *
   * @type {AccountEvents}
   * @readonly
   */
  readonly events: AccountEvents;
  // #endregion
}

/**
 * Interface UnitOfWorkOptions
 *
 * @description
 * How the transaction of a unit of work is opened.
 */
export interface UnitOfWorkOptions {
  // #region Properties
  /**
   * Property readOnly
   *
   * @description
   * Opens a read-only transaction, for a query.
   *
   * @type {boolean | undefined}
   * @readonly
   */
  readonly readOnly?: boolean;
  // #endregion
}

/**
 * Interface AccountsUnitOfWork
 *
 * @description
 * One transaction of the accounts module. The work commits when it resolves and rolls back when it
 * rejects: a use case that must keep a counted failure returns its refusal and throws it after the
 * commit. A session opened through the `SessionOpener` port inside the work joins the transaction.
 */
export interface AccountsUnitOfWork {
  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in one transaction with the repositories bound to it.
   *
   * @param {(store: AccountsStore) => Promise<TResult>} work - The unit of work.
   * @param {UnitOfWorkOptions} options - How the transaction is opened.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  run<TResult>(
    work: (store: AccountsStore) => Promise<TResult>,
    options?: UnitOfWorkOptions,
  ): Promise<TResult>;
  // #endregion
}
