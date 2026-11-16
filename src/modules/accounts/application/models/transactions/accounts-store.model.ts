import type { AccountEvents } from '../../ports/outbound/messaging/accounts/account-events.port.js';
import type { CodeRequestRepository } from '../../ports/outbound/persistence/accounts/code-request-repository.port.js';
import type { OneTimeCodeRepository } from '../../ports/outbound/persistence/accounts/one-time-code-repository.port.js';
import type { PasswordCredentialRepository } from '../../ports/outbound/persistence/accounts/password-credential-repository.port.js';
import type { SignInAttemptRepository } from '../../ports/outbound/persistence/accounts/sign-in-attempt-repository.port.js';
import type { UserRepository } from '../../ports/outbound/persistence/accounts/user-repository.port.js';

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
