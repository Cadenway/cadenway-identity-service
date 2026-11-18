import type { BackupCodeRepository } from '../../ports/outbound/persistence/two-step/backup-code-repository.port.js';
import type { PendingTwoStepRepository } from '../../ports/outbound/persistence/two-step/pending-two-step-repository.port.js';
import type { SecurityKeyRepository } from '../../ports/outbound/persistence/two-step/security-key-repository.port.js';
import type { SignInChallengeRepository } from '../../ports/outbound/persistence/two-step/sign-in-challenge-repository.port.js';
import type { TwoStepVerificationRepository } from '../../ports/outbound/persistence/two-step/two-step-verification-repository.port.js';
import type { AccountDeletionQueue } from '../../ports/outbound/jobs/accounts/account-deletion-queue.port.js';
import type { AccountEvents } from '../../ports/outbound/messaging/accounts/account-events.port.js';
import type { CodeRequestRepository } from '../../ports/outbound/persistence/accounts/code-request-repository.port.js';
import type { EmailChangeRepository } from '../../ports/outbound/persistence/accounts/email-change-repository.port.js';
import type { OneTimeCodeRepository } from '../../ports/outbound/persistence/accounts/one-time-code-repository.port.js';
import type { PasswordCredentialRepository } from '../../ports/outbound/persistence/accounts/password-credential-repository.port.js';
import type { PasswordResetLinkRepository } from '../../ports/outbound/persistence/accounts/password-reset-link-repository.port.js';
import type { PasswordResetRequestRepository } from '../../ports/outbound/persistence/accounts/password-reset-request-repository.port.js';
import type { SignInAttemptRepository } from '../../ports/outbound/persistence/accounts/sign-in-attempt-repository.port.js';
import type { UserRepository } from '../../ports/outbound/persistence/accounts/user-repository.port.js';

/**
 * Interface AccountsStore
 *
 * @description
 * The repositories, the outbox and the job queue of one transaction.
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
   * The throttle of the code requests, per address.
   *
   * @type {CodeRequestRepository}
   * @readonly
   */
  readonly codeRequests: CodeRequestRepository;

  /**
   * Property signInAttempts
   *
   * @description
   * The lockout of the password sign-in, per address.
   *
   * @type {SignInAttemptRepository}
   * @readonly
   */
  readonly signInAttempts: SignInAttemptRepository;

  /**
   * Property resetLinks
   *
   * @description
   * The password reset links.
   *
   * @type {PasswordResetLinkRepository}
   * @readonly
   */
  readonly resetLinks: PasswordResetLinkRepository;

  /**
   * Property resetRequests
   *
   * @description
   * The throttle of the password reset requests, per address.
   *
   * @type {PasswordResetRequestRepository}
   * @readonly
   */
  readonly resetRequests: PasswordResetRequestRepository;

  /**
   * Property emailChanges
   *
   * @description
   * The pending changes of address.
   *
   * @type {EmailChangeRepository}
   * @readonly
   */
  readonly emailChanges: EmailChangeRepository;

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

  /**
   * Property deletionQueue
   *
   * @description
   * The jobs that delete accounts, enqueued in the transaction.
   *
   * @type {AccountDeletionQueue}
   * @readonly
   */
  readonly deletionQueue: AccountDeletionQueue;

  /**
   * Property twoStep
   *
   * @description
   * The two-step verification of the accounts.
   *
   * @type {TwoStepVerificationRepository}
   * @readonly
   */
  readonly twoStep: TwoStepVerificationRepository;

  /**
   * Property backupCodes
   *
   * @description
   * Their backup codes, as keyed hashes.
   *
   * @type {BackupCodeRepository}
   * @readonly
   */
  readonly backupCodes: BackupCodeRepository;

  /**
   * Property securityKeys
   *
   * @description
   * Their security keys.
   *
   * @type {SecurityKeyRepository}
   * @readonly
   */
  readonly securityKeys: SecurityKeyRepository;

  /**
   * Property pendingTwoStep
   *
   * @description
   * Their pending setups of an app and registrations of a key.
   *
   * @type {PendingTwoStepRepository}
   * @readonly
   */
  readonly pendingTwoStep: PendingTwoStepRepository;

  /**
   * Property challenges
   *
   * @description
   * Their open sign-in challenges.
   *
   * @type {SignInChallengeRepository}
   * @readonly
   */
  readonly challenges: SignInChallengeRepository;
  // #endregion
}
