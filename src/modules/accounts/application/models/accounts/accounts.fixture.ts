import type { UserRegistration } from '../../../domain/aggregates/account/user-registration.aggregate.js';
import { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { OneTimeCodeIssue } from '../../../domain/aggregates/one-time-codes/one-time-code-issue.aggregate.js';
import type { OneTimeCodeState } from '../../../domain/aggregates/one-time-codes/one-time-code-state.aggregate.js';
import { OneTimeCode } from '../../../domain/aggregates/one-time-codes/one-time-code.aggregate.js';
import type { PasswordResetLinkIssue } from '../../../domain/aggregates/password-reset/password-reset-link-issue.aggregate.js';
import type { PasswordResetLinkState } from '../../../domain/aggregates/password-reset/password-reset-link-state.aggregate.js';
import { PasswordResetLink } from '../../../domain/aggregates/password-reset/password-reset-link.aggregate.js';
import type { SignInChallengeIssue } from '../../../domain/aggregates/two-step/sign-in-challenge-issue.aggregate.js';
import type { SignInChallengeState } from '../../../domain/aggregates/two-step/sign-in-challenge-state.aggregate.js';
import { SignInChallenge } from '../../../domain/aggregates/two-step/sign-in-challenge.aggregate.js';
import type { TwoStepVerification } from '../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import { CodeRequestThrottle } from '../../../domain/policies/one-time-codes/code-request-throttle.policy.js';
import { PasswordResetThrottle } from '../../../domain/policies/password-reset/password-reset-throttle.policy.js';
import { PasswordLockout } from '../../../domain/policies/password/password-lockout.policy.js';
import type { PendingEmailChange } from '../../../domain/value-objects/email-change/pending-email-change.value-object.js';
import { EmailAddress } from '../../../domain/value-objects/email/email-address.value-object.js';
import type { OneTimeCodePurpose } from '../../../domain/value-objects/one-time-code-purpose/one-time-code-purpose.value-object.js';
import type { PendingTwoStepStart } from '../../../domain/value-objects/two-step/pending-two-step-start.value-object.js';
import type { Clock } from '../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountApiTokens } from '../../ports/outbound/identity/api-tokens/account-api-tokens.port.js';
import type { AccountSessions } from '../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { SessionOpener } from '../../ports/outbound/identity/sessions/session-opener.port.js';
import type { TwoStepEnrollments } from '../../ports/outbound/identity/sessions/two-step-enrollments.port.js';
import type { AccountDeletionQueue } from '../../ports/outbound/jobs/accounts/account-deletion-queue.port.js';
import type { OwnedOrganizations } from '../../ports/outbound/memberships/accounts/owned-organizations.port.js';
import type { AccountEvents } from '../../ports/outbound/messaging/accounts/account-events.port.js';
import type { CodeRequestRepository } from '../../ports/outbound/persistence/accounts/code-request-repository.port.js';
import type { EmailChangeRepository } from '../../ports/outbound/persistence/accounts/email-change-repository.port.js';
import type { OneTimeCodeRepository } from '../../ports/outbound/persistence/accounts/one-time-code-repository.port.js';
import type { PasswordCredentialRepository } from '../../ports/outbound/persistence/accounts/password-credential-repository.port.js';
import type { PasswordResetLinkRepository } from '../../ports/outbound/persistence/accounts/password-reset-link-repository.port.js';
import type { PasswordResetRequestRepository } from '../../ports/outbound/persistence/accounts/password-reset-request-repository.port.js';
import type { SignInAttemptRepository } from '../../ports/outbound/persistence/accounts/sign-in-attempt-repository.port.js';
import type { UserRepository } from '../../ports/outbound/persistence/accounts/user-repository.port.js';
import type { BackupCodeRepository } from '../../ports/outbound/persistence/two-step/backup-code-repository.port.js';
import type { PendingTwoStepRepository } from '../../ports/outbound/persistence/two-step/pending-two-step-repository.port.js';
import type { SecurityKeyRepository } from '../../ports/outbound/persistence/two-step/security-key-repository.port.js';
import type { SignInChallengeRepository } from '../../ports/outbound/persistence/two-step/sign-in-challenge-repository.port.js';
import type { TwoStepVerificationRepository } from '../../ports/outbound/persistence/two-step/two-step-verification-repository.port.js';
import type { CompromisedPasswords } from '../../ports/outbound/security/authentication/compromised-passwords.port.js';
import type { OneTimeCodeSecrets } from '../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { PasswordHasher } from '../../ports/outbound/security/authentication/password-hasher.port.js';
import type { ResetLinkSecrets } from '../../ports/outbound/security/password-reset/reset-link-secrets.port.js';
import type { AccountsUnitOfWork } from '../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { CodeSubject } from '../authentication/code-subject.model.js';
import type { IssuedCode } from '../authentication/issued-code.model.js';
import type { DueAccountDeletion } from '../deletion/due-account-deletion.model.js';
import type { IssuedResetLink } from '../password-reset/issued-reset-link.model.js';
import type { IssuedResetToken } from '../password-reset/issued-reset-token.model.js';
import type { ClientDescription } from '../sessions/client-description.model.js';
import type { ClientDevice } from '../sessions/client-device.model.js';
import type { OpenedSession } from '../sessions/opened-session.model.js';
import type { RecentAuthentication } from '../sessions/recent-authentication.model.js';
import type { SessionAuthentication } from '../sessions/session-authentication.model.js';
import type { SessionRequest } from '../sessions/session-request.model.js';
import type { AccountsStore } from '../transactions/accounts-store.model.js';
import type { SecurityKeyRecord } from '../two-step/security-key-record.model.js';
import type { TwoStepSummary } from '../two-step/two-step-summary.model.js';
import type { VerifiedRegistration } from '../two-step/verified-registration.model.js';

/**
 * Type RecordedEvent
 *
 * @description
 * An event a use case appended, as the fake outbox keeps it.
 *
 * @type {object}
 */
export type RecordedEvent =
  | {
      readonly name: 'user.signed-up.v1' | 'user.email-verified.v1' | 'user.deletion-scheduled.v1';
      readonly user: User;
    }
  | { readonly name: 'one-time-code.issued.v1'; readonly issued: IssuedCode }
  | { readonly name: 'password-reset-link.issued.v1'; readonly issued: IssuedResetLink }
  | {
      readonly name: 'user.profile-updated.v1';
      readonly user: User;
      readonly changed: readonly string[];
    }
  | {
      readonly name: 'user.password-changed.v1';
      readonly user: User;
      readonly method: 'change' | 'reset';
      readonly closedSessionCount: number;
      readonly client: ClientDescription;
    }
  | {
      readonly name: 'user.email-changed.v1';
      readonly user: User;
      readonly previousEmail: string;
      readonly client: ClientDescription;
    }
  | {
      readonly name: 'user.deletion-cancelled.v1';
      readonly user: User;
      readonly sessionId: string;
      readonly client: ClientDescription;
    }
  | { readonly name: 'user.deleted.v1'; readonly userId: string; readonly version: number }
  | {
      readonly name: 'user.two-step-verification-changed.v1';
      readonly user: User;
      readonly summary: TwoStepSummary;
      readonly client: ClientDescription;
    };

/**
 * Interface AccountsState
 *
 * @description
 * Everything the fake database holds; copied at the start of a transaction and kept only when the
 * work resolves.
 */
interface AccountsState {
  // #region Properties
  /**
   * Property users
   *
   * @description
   * Accounts by id.
   *
   * @type {Map<string, User>}
   * @readonly
   */
  readonly users: Map<string, User>;

  /**
   * Property credentials
   *
   * @description
   * Password hashes by account id.
   *
   * @type {Map<string, string>}
   * @readonly
   */
  readonly credentials: Map<string, string>;

  /**
   * Property codes
   *
   * @description
   * Codes, in issue order.
   *
   * @type {OneTimeCodeState[]}
   * @readonly
   */
  readonly codes: OneTimeCodeState[];

  /**
   * Property codeRequests
   *
   * @description
   * Throttles by address.
   *
   * @type {Map<string, CodeRequestThrottle>}
   * @readonly
   */
  readonly codeRequests: Map<string, CodeRequestThrottle>;

  /**
   * Property lockouts
   *
   * @description
   * Lockouts by address.
   *
   * @type {Map<string, PasswordLockout>}
   * @readonly
   */
  readonly lockouts: Map<string, PasswordLockout>;

  /**
   * Property events
   *
   * @description
   * Appended events.
   *
   * @type {RecordedEvent[]}
   * @readonly
   */
  readonly events: RecordedEvent[];

  /**
   * Property resetLinks
   *
   * @description
   * Password reset links, in issue order.
   *
   * @type {PasswordResetLinkState[]}
   * @readonly
   */
  readonly resetLinks: PasswordResetLinkState[];

  /**
   * Property resetRequests
   *
   * @description
   * Throttles of the reset requests by address.
   *
   * @type {Map<string, PasswordResetThrottle>}
   * @readonly
   */
  readonly resetRequests: Map<string, PasswordResetThrottle>;

  /**
   * Property emailChanges
   *
   * @description
   * Pending changes of address by account.
   *
   * @type {Map<string, PendingEmailChange>}
   * @readonly
   */
  readonly emailChanges: Map<string, PendingEmailChange>;

  /**
   * Property deletionJobs
   *
   * @description
   * Occurrence keys of the enqueued deletion jobs.
   *
   * @type {string[]}
   * @readonly
   */
  readonly deletionJobs: string[];

  /**
   * Property deletionChecks
   *
   * @description
   * Last check that kept a due deletion, by account.
   *
   * @type {Map<string, Date>}
   * @readonly
   */
  readonly deletionChecks: Map<string, Date>;

  /** Stable deletion attempts, committed independently of the remote reservation. */
  readonly deletionAttempts: Map<string, string>;

  /**
   * Property twoStep
   *
   * @description
   * Two-step verifications by account.
   *
   * @type {Map<string, TwoStepVerification>}
   * @readonly
   */
  readonly twoStep: Map<string, TwoStepVerification>;

  /**
   * Property backupCodes
   *
   * @description
   * Backup codes, as keyed hashes, with when each was used.
   *
   * @type {{ readonly userId: string; readonly codeHash: string; readonly usedAt: Date | null }[]}
   * @readonly
   */
  readonly backupCodes: {
    readonly userId: string;
    readonly codeHash: string;
    readonly usedAt: Date | null;
  }[];

  /**
   * Property securityKeys
   *
   * @description
   * Security keys, with their account.
   *
   * @type {(SecurityKeyRecord & { readonly userId: string })[]}
   * @readonly
   */
  readonly securityKeys: (SecurityKeyRecord & { readonly userId: string })[];

  /**
   * Property setups
   *
   * @description
   * Pending setups of an authenticator app by account.
   *
   * @type {Map<string, PendingTwoStepStart>}
   * @readonly
   */
  readonly setups: Map<string, PendingTwoStepStart>;

  /**
   * Property registrations
   *
   * @description
   * Pending registrations of a security key by account.
   *
   * @type {Map<string, PendingTwoStepStart>}
   * @readonly
   */
  readonly registrations: Map<string, PendingTwoStepStart>;

  /**
   * Property challenges
   *
   * @description
   * Open two-step challenges by account.
   *
   * @type {Map<string, SignInChallengeState>}
   * @readonly
   */
  readonly challenges: Map<string, SignInChallengeState>;
  // #endregion
}

/**
 * Function copyState
 *
 * @description
 * Copies the state; the domain objects are immutable, so a shallow copy of each collection is a
 * snapshot.
 *
 * @param {AccountsState} state - The state.
 * @returns {AccountsState} Its copy.
 */
function copyState(state: AccountsState): AccountsState {
  return {
    users: new Map(state.users),
    credentials: new Map(state.credentials),
    codes: [...state.codes],
    codeRequests: new Map(state.codeRequests),
    lockouts: new Map(state.lockouts),
    events: [...state.events],
    resetLinks: [...state.resetLinks],
    resetRequests: new Map(state.resetRequests),
    emailChanges: new Map(state.emailChanges),
    deletionJobs: [...state.deletionJobs],
    deletionChecks: new Map(state.deletionChecks),
    deletionAttempts: new Map(state.deletionAttempts),
    twoStep: new Map(state.twoStep),
    backupCodes: [...state.backupCodes],
    securityKeys: [...state.securityKeys],
    setups: new Map(state.setups),
    registrations: new Map(state.registrations),
    challenges: new Map(state.challenges),
  };
}

/**
 * Function fakeId
 *
 * @description
 * A UUID version 7 shaped id, as PostgreSQL would assign, numbered.
 *
 * @param {number} index - Rank of the id.
 * @returns {string} The id.
 */
function fakeId(index: number): string {
  return `019a5f3c-8d2e-7c4a-9b1f-${String(index).padStart(12, '0')}`;
}

/**
 * Class InMemoryAccounts
 *
 * @description
 * A fake `AccountsUnitOfWork` holding its data in memory, with the commit and rollback of a real
 * transaction: what the work wrote is kept only when it resolves.
 */
export class InMemoryAccounts implements AccountsUnitOfWork {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * The committed state.
   *
   * @type {AccountsState}
   */
  public state: AccountsState = {
    users: new Map(),
    credentials: new Map(),
    codes: [],
    codeRequests: new Map(),
    lockouts: new Map(),
    events: [],
    resetLinks: [],
    resetRequests: new Map(),
    emailChanges: new Map(),
    deletionJobs: [],
    deletionChecks: new Map(),
    deletionAttempts: new Map(),
    twoStep: new Map(),
    backupCodes: [],
    securityKeys: [],
    setups: new Map(),
    registrations: new Map(),
    challenges: new Map(),
  };

  /**
   * Property inTransaction
   *
   * @description
   * Whether a unit of work is running, so a fake port can check it is called inside one.
   *
   * @type {boolean}
   */
  public inTransaction: boolean = false;

  /**
   * Property ids
   *
   * @description
   * Ids assigned so far.
   *
   * @type {number}
   */
  private ids: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs the work on a copy of the state, committed when it resolves.
   *
   * @param {(store: AccountsStore) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with.
   */
  public async run<TResult>(work: (store: AccountsStore) => Promise<TResult>): Promise<TResult> {
    const draft: AccountsState = copyState(this.state);
    this.inTransaction = true;
    try {
      const result: TResult = await work(this.storeOf(draft));
      this.state = draft;
      return result;
    } finally {
      this.inTransaction = false;
    }
  }

  /**
   * Method userByEmail
   *
   * @description
   * The committed account of an address.
   *
   * @param {string} email - The address, as typed.
   * @returns {User | undefined} The account.
   */
  public userByEmail(email: string): User | undefined {
    const address: EmailAddress = EmailAddress.of(email);
    return [...this.state.users.values()].find((user: User) => user.email.equals(address));
  }

  /**
   * Method seedUser
   *
   * @description
   * Stores an account, verified or not, with a password hash.
   *
   * @param {string} email - The address.
   * @param {boolean} verified - Whether the address is verified.
   * @param {string} passwordHash - The stored hash.
   * @param {Date | null} deleteAt - The end of a scheduled deletion of a verified account, or
   * `null`.
   * @returns {User} The account.
   */
  public seedUser(
    email: string,
    verified: boolean,
    passwordHash: string,
    deleteAt: Date | null = null,
  ): User {
    this.ids += 1;
    const user: User = User.restore({
      id: fakeId(this.ids),
      email: EmailAddress.of(email),
      name: 'Camille Martin',
      language: 'fr',
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
      emailVerifiedAt: verified ? new Date('2026-11-08T12:00:00Z') : null,
      version: verified ? (deleteAt === null ? 2 : 3) : 1,
      signUpCount: 1,
      passwordChangedAt: new Date('2026-08-12T09:30:00Z'),
      deleteAt,
    });
    this.state.users.set(user.id, user);
    this.state.credentials.set(user.id, passwordHash);
    return user;
  }

  /**
   * Method storeOf
   *
   * @description
   * The repositories of a draft state.
   *
   * @param {AccountsState} draft - The state of the transaction.
   * @returns {AccountsStore} The repositories.
   */
  private storeOf(draft: AccountsState): AccountsStore {
    const users: UserRepository = {
      findByEmail: (email: EmailAddress): Promise<User | null> =>
        Promise.resolve(
          [...draft.users.values()].find((user: User) => user.email.equals(email)) ?? null,
        ),
      findById: (id: string): Promise<User | null> => Promise.resolve(draft.users.get(id) ?? null),
      lock: (id: string): Promise<User | null> => Promise.resolve(draft.users.get(id) ?? null),
      insert: (registration: UserRegistration): Promise<User> => {
        this.ids += 1;
        const user: User = User.restore({
          ...registration,
          id: fakeId(this.ids),
          emailVerifiedAt: null,
          deleteAt: null,
        });
        draft.users.set(user.id, user);
        return Promise.resolve(user);
      },
      update: (user: User): Promise<void> => {
        if (draft.users.get(user.id)?.version !== user.version - 1) {
          return Promise.reject(new Error('The account changed since it was loaded.'));
        }
        draft.users.set(user.id, user);
        return Promise.resolve();
      },
      findDueDeletions: (
        now: Date,
        checkedBefore: Date,
        limit: number,
      ): Promise<DueAccountDeletion[]> =>
        Promise.resolve(
          [...draft.users.values()]
            .filter((user: User) => user.isDeletionDueAt(now))
            .filter((user: User) => {
              const checked: Date | undefined = draft.deletionChecks.get(user.id);
              return checked === undefined || checked.getTime() <= checkedBefore.getTime();
            })
            .map((user: User) => ({
              userId: user.id,
              dueSince: draft.deletionChecks.get(user.id) ?? user.deleteAt ?? now,
            }))
            .sort(
              (left, right) =>
                left.dueSince.getTime() - right.dueSince.getTime() ||
                left.userId.localeCompare(right.userId),
            )
            .slice(0, limit),
        ),
      markDeletionsDispatched: (userIds: readonly string[], now: Date): Promise<void> => {
        for (const userId of userIds) draft.deletionChecks.set(userId, now);
        return Promise.resolve();
      },
      findDeletionAttempt: (userId: string): Promise<string | null> =>
        Promise.resolve(draft.deletionAttempts.get(userId) ?? null),
      claimDeletion: (userId: string): Promise<string> => {
        this.ids += 1;
        const attemptId = fakeId(this.ids);
        draft.deletionAttempts.set(userId, attemptId);
        return Promise.resolve(attemptId);
      },
      keepDeletion: (userId: string, attemptId: string, now: Date): Promise<void> => {
        if (draft.deletionAttempts.get(userId) === attemptId) {
          draft.deletionAttempts.delete(userId);
          draft.deletionChecks.set(userId, now);
        }
        return Promise.resolve();
      },
      delete: (user: User, confirmedAttemptId?: string): Promise<void> => {
        if (draft.users.get(user.id)?.version !== user.version) {
          return Promise.reject(new Error('The account changed since it was loaded.'));
        }
        if (
          user.deleteAt !== null &&
          (confirmedAttemptId === undefined ||
            draft.deletionAttempts.get(user.id) !== confirmedAttemptId)
        ) {
          return Promise.reject(
            new Error('A scheduled account deletion requires its confirmed attempt.'),
          );
        }
        draft.users.delete(user.id);
        draft.deletionAttempts.delete(user.id);
        draft.credentials.delete(user.id);
        draft.emailChanges.delete(user.id);
        return Promise.resolve();
      },
    };
    const credentials: PasswordCredentialRepository = {
      findHash: (userId: string): Promise<string | null> =>
        Promise.resolve(draft.credentials.get(userId) ?? null),
      save: (userId: string, passwordHash: string): Promise<void> => {
        draft.credentials.set(userId, passwordHash);
        return Promise.resolve();
      },
    };
    const codes: OneTimeCodeRepository = {
      findCurrent: (userId: string, purpose: OneTimeCodePurpose): Promise<OneTimeCode | null> => {
        const current: OneTimeCodeState | undefined = draft.codes.findLast(
          (code: OneTimeCodeState) =>
            code.userId === userId &&
            code.purpose === purpose &&
            code.consumedAt === null &&
            code.replacedAt === null,
        );
        return Promise.resolve(current === undefined ? null : OneTimeCode.restore(current));
      },
      replaceCurrent: (userId: string, purpose: OneTimeCodePurpose, now: Date): Promise<void> => {
        draft.codes.forEach((code: OneTimeCodeState, index: number) => {
          if (
            code.userId === userId &&
            code.purpose === purpose &&
            code.consumedAt === null &&
            code.replacedAt === null
          ) {
            draft.codes[index] = { ...code, replacedAt: now };
          }
        });
        return Promise.resolve();
      },
      replaceAllCurrent: (userId: string, now: Date): Promise<void> => {
        draft.codes.forEach((code: OneTimeCodeState, index: number) => {
          if (code.userId === userId && code.consumedAt === null && code.replacedAt === null) {
            draft.codes[index] = { ...code, replacedAt: now };
          }
        });
        return Promise.resolve();
      },
      insert: (issue: OneTimeCodeIssue): Promise<OneTimeCode> => {
        this.ids += 1;
        const state: OneTimeCodeState = {
          ...issue,
          id: fakeId(this.ids),
          failedAttempts: 0,
          consumedAt: null,
          replacedAt: null,
        };
        draft.codes.push(state);
        return Promise.resolve(OneTimeCode.restore(state));
      },
      save: (code: OneTimeCode): Promise<void> => {
        const index: number = draft.codes.findIndex(
          (stored: OneTimeCodeState) => stored.id === code.id,
        );
        draft.codes[index] = code.snapshot;
        return Promise.resolve();
      },
      endedWithHash: (
        userId: string,
        purpose: OneTimeCodePurpose,
        codeHash: string,
      ): Promise<boolean> =>
        Promise.resolve(
          draft.codes.some(
            (code: OneTimeCodeState) =>
              code.userId === userId &&
              code.purpose === purpose &&
              code.codeHash === codeHash &&
              (code.consumedAt !== null || code.replacedAt !== null),
          ),
        ),
    };
    const codeRequests: CodeRequestRepository = {
      lock: (email: EmailAddress): Promise<CodeRequestThrottle> =>
        Promise.resolve(draft.codeRequests.get(email.value) ?? CodeRequestThrottle.none()),
      save: (email: EmailAddress, throttle: CodeRequestThrottle): Promise<void> => {
        draft.codeRequests.set(email.value, throttle);
        return Promise.resolve();
      },
      erase: (email: EmailAddress): Promise<void> => {
        draft.codeRequests.delete(email.value);
        return Promise.resolve();
      },
    };
    const signInAttempts: SignInAttemptRepository = {
      lock: (email: EmailAddress): Promise<PasswordLockout> =>
        Promise.resolve(draft.lockouts.get(email.value) ?? PasswordLockout.clear()),
      save: (email: EmailAddress, lockout: PasswordLockout): Promise<void> => {
        if (lockout.isClear) {
          draft.lockouts.delete(email.value);
        } else {
          draft.lockouts.set(email.value, lockout);
        }
        return Promise.resolve();
      },
      erase: (email: EmailAddress): Promise<void> => {
        draft.lockouts.delete(email.value);
        return Promise.resolve();
      },
    };
    const events: AccountEvents = {
      userSignedUp: (user: User): Promise<void> => {
        draft.events.push({ name: 'user.signed-up.v1', user });
        return Promise.resolve();
      },
      userEmailVerified: (user: User): Promise<void> => {
        draft.events.push({ name: 'user.email-verified.v1', user });
        return Promise.resolve();
      },
      userProfileUpdated: (user: User, changed: readonly string[]): Promise<void> => {
        draft.events.push({ name: 'user.profile-updated.v1', user, changed });
        return Promise.resolve();
      },
      oneTimeCodeIssued: (issued: IssuedCode): Promise<void> => {
        draft.events.push({ name: 'one-time-code.issued.v1', issued });
        return Promise.resolve();
      },
      passwordResetLinkIssued: (issued: IssuedResetLink): Promise<void> => {
        draft.events.push({ name: 'password-reset-link.issued.v1', issued });
        return Promise.resolve();
      },
      userPasswordChanged: (
        user: User,
        method: 'change' | 'reset',
        closedSessionCount: number,
        client: ClientDescription,
      ): Promise<void> => {
        draft.events.push({
          name: 'user.password-changed.v1',
          user,
          method,
          closedSessionCount,
          client,
        });
        return Promise.resolve();
      },
      userEmailChanged: (
        user: User,
        previousEmail: EmailAddress,
        client: ClientDescription,
      ): Promise<void> => {
        draft.events.push({
          name: 'user.email-changed.v1',
          user,
          previousEmail: previousEmail.value,
          client,
        });
        return Promise.resolve();
      },
      userDeletionScheduled: (user: User): Promise<void> => {
        draft.events.push({ name: 'user.deletion-scheduled.v1', user });
        return Promise.resolve();
      },
      userDeletionCancelled: (
        user: User,
        sessionId: string,
        client: ClientDescription,
      ): Promise<void> => {
        draft.events.push({ name: 'user.deletion-cancelled.v1', user, sessionId, client });
        return Promise.resolve();
      },
      userDeleted: (userId: string, version: number): Promise<void> => {
        draft.events.push({ name: 'user.deleted.v1', userId, version });
        return Promise.resolve();
      },
      userTwoStepVerificationChanged: (
        user: User,
        summary: TwoStepSummary,
        client: ClientDescription,
      ): Promise<void> => {
        draft.events.push({ name: 'user.two-step-verification-changed.v1', user, summary, client });
        return Promise.resolve();
      },
    };
    const resetLinks: PasswordResetLinkRepository = {
      findByTokenHash: (tokenHash: string): Promise<PasswordResetLink | null> => {
        const found: PasswordResetLinkState | undefined = draft.resetLinks.find(
          (link: PasswordResetLinkState) => link.tokenHash === tokenHash,
        );
        return Promise.resolve(found === undefined ? null : PasswordResetLink.restore(found));
      },
      replaceCurrent: (userId: string, now: Date): Promise<void> => {
        draft.resetLinks.forEach((link: PasswordResetLinkState, index: number) => {
          if (link.userId === userId && link.usedAt === null && link.replacedAt === null) {
            draft.resetLinks[index] = { ...link, replacedAt: now };
          }
        });
        return Promise.resolve();
      },
      insert: (issue: PasswordResetLinkIssue): Promise<PasswordResetLink> => {
        this.ids += 1;
        const state: PasswordResetLinkState = {
          ...issue,
          id: fakeId(this.ids),
          usedAt: null,
          replacedAt: null,
        };
        draft.resetLinks.push(state);
        return Promise.resolve(PasswordResetLink.restore(state));
      },
      save: (link: PasswordResetLink): Promise<void> => {
        const index: number = draft.resetLinks.findIndex(
          (stored: PasswordResetLinkState) => stored.id === link.id,
        );
        draft.resetLinks[index] = link.snapshot;
        return Promise.resolve();
      },
    };
    const resetRequests: PasswordResetRequestRepository = {
      lock: (email: EmailAddress): Promise<PasswordResetThrottle> =>
        Promise.resolve(draft.resetRequests.get(email.value) ?? PasswordResetThrottle.none()),
      save: (email: EmailAddress, throttle: PasswordResetThrottle): Promise<void> => {
        draft.resetRequests.set(email.value, throttle);
        return Promise.resolve();
      },
      erase: (email: EmailAddress): Promise<void> => {
        draft.resetRequests.delete(email.value);
        return Promise.resolve();
      },
    };
    const emailChanges: EmailChangeRepository = {
      find: (userId: string): Promise<PendingEmailChange | null> =>
        Promise.resolve(draft.emailChanges.get(userId) ?? null),
      save: (change: PendingEmailChange): Promise<void> => {
        draft.emailChanges.set(change.userId, change);
        return Promise.resolve();
      },
      drop: (userId: string): Promise<void> => {
        draft.emailChanges.delete(userId);
        return Promise.resolve();
      },
    };
    const deletionQueue: AccountDeletionQueue = {
      enqueue: (userId: string, occurrence: string): Promise<boolean> => {
        const key: string = `${userId}:${occurrence}`;
        if (draft.deletionJobs.includes(key)) {
          return Promise.resolve(false);
        }
        draft.deletionJobs.push(key);
        return Promise.resolve(true);
      },
    };
    const twoStep: TwoStepVerificationRepository = {
      find: (userId: string): Promise<TwoStepVerification | null> =>
        Promise.resolve(draft.twoStep.get(userId) ?? null),
      lock: (userId: string): Promise<TwoStepVerification | null> =>
        Promise.resolve(draft.twoStep.get(userId) ?? null),
      insert: (verification: TwoStepVerification): Promise<void> => {
        if (draft.twoStep.has(verification.userId)) {
          return Promise.reject(new Error('The account already has two-step verification.'));
        }
        draft.twoStep.set(verification.userId, verification);
        return Promise.resolve();
      },
      update: (verification: TwoStepVerification): Promise<void> => {
        draft.twoStep.set(verification.userId, verification);
        return Promise.resolve();
      },
      delete: (userId: string): Promise<void> => {
        draft.twoStep.delete(userId);
        return Promise.resolve();
      },
    };
    const backupCodes: BackupCodeRepository = {
      replaceAll: (userId: string, codeHashes: readonly string[]): Promise<void> => {
        draft.backupCodes.splice(
          0,
          draft.backupCodes.length,
          ...draft.backupCodes.filter(
            (code: { readonly userId: string }) => code.userId !== userId,
          ),
          ...codeHashes.map((codeHash: string) => ({ userId, codeHash, usedAt: null })),
        );
        return Promise.resolve();
      },
      countUnused: (userId: string): Promise<number> =>
        Promise.resolve(
          draft.backupCodes.filter(
            (code: { readonly userId: string; readonly usedAt: Date | null }) =>
              code.userId === userId && code.usedAt === null,
          ).length,
        ),
      use: (userId: string, codeHash: string, now: Date): Promise<boolean> => {
        const index: number = draft.backupCodes.findIndex(
          (code: {
            readonly userId: string;
            readonly codeHash: string;
            readonly usedAt: Date | null;
          }) => code.userId === userId && code.codeHash === codeHash && code.usedAt === null,
        );
        if (index < 0) {
          return Promise.resolve(false);
        }
        draft.backupCodes[index] = { userId, codeHash, usedAt: now };
        return Promise.resolve(true);
      },
      deleteOfUser: (userId: string): Promise<void> => {
        draft.backupCodes.splice(
          0,
          draft.backupCodes.length,
          ...draft.backupCodes.filter(
            (code: { readonly userId: string }) => code.userId !== userId,
          ),
        );
        return Promise.resolve();
      },
    };
    const securityKeys: SecurityKeyRepository = {
      listOfUser: (userId: string): Promise<SecurityKeyRecord[]> =>
        Promise.resolve(
          draft.securityKeys.filter((key: { readonly userId: string }) => key.userId === userId),
        ),
      findOfUser: (userId: string, id: string): Promise<SecurityKeyRecord | null> =>
        Promise.resolve(
          draft.securityKeys.find(
            (key: SecurityKeyRecord & { readonly userId: string }) =>
              key.userId === userId && key.id === id,
          ) ?? null,
        ),
      credentialExists: (credentialId: string): Promise<boolean> =>
        Promise.resolve(
          draft.securityKeys.some((key: SecurityKeyRecord) => key.credentialId === credentialId),
        ),
      insert: (
        userId: string,
        name: string,
        credential: VerifiedRegistration,
      ): Promise<SecurityKeyRecord> => {
        this.ids += 1;
        const key: SecurityKeyRecord & { readonly userId: string } = {
          id: fakeId(this.ids),
          userId,
          name,
          credentialId: credential.credentialId,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: credential.transports,
          createdAt: new Date('2026-11-09T13:12:00Z'),
          lastUsedAt: null,
        };
        draft.securityKeys.push(key);
        return Promise.resolve(key);
      },
      recordUse: (id: string, counter: number, now: Date): Promise<void> => {
        const index: number = draft.securityKeys.findIndex(
          (key: SecurityKeyRecord) => key.id === id,
        );
        const key: (SecurityKeyRecord & { readonly userId: string }) | undefined =
          draft.securityKeys[index];
        if (key !== undefined) {
          draft.securityKeys[index] = { ...key, counter, lastUsedAt: now };
        }
        return Promise.resolve();
      },
      delete: (id: string): Promise<void> => {
        draft.securityKeys.splice(
          0,
          draft.securityKeys.length,
          ...draft.securityKeys.filter((key: SecurityKeyRecord) => key.id !== id),
        );
        return Promise.resolve();
      },
      deleteOfUser: (userId: string): Promise<void> => {
        draft.securityKeys.splice(
          0,
          draft.securityKeys.length,
          ...draft.securityKeys.filter((key: { readonly userId: string }) => key.userId !== userId),
        );
        return Promise.resolve();
      },
    };
    const pendingTwoStep: PendingTwoStepRepository = {
      putSetup: (userId: string, pending: PendingTwoStepStart): Promise<void> => {
        draft.setups.set(userId, pending);
        return Promise.resolve();
      },
      findSetup: (userId: string): Promise<PendingTwoStepStart | null> =>
        Promise.resolve(draft.setups.get(userId) ?? null),
      putRegistration: (userId: string, pending: PendingTwoStepStart): Promise<void> => {
        draft.registrations.set(userId, pending);
        return Promise.resolve();
      },
      findRegistration: (userId: string): Promise<PendingTwoStepStart | null> =>
        Promise.resolve(draft.registrations.get(userId) ?? null),
      deleteSetup: (userId: string): Promise<void> => {
        draft.setups.delete(userId);
        return Promise.resolve();
      },
      deleteRegistration: (userId: string): Promise<void> => {
        draft.registrations.delete(userId);
        return Promise.resolve();
      },
      dropOfOtherSessions: (userId: string, sessionId: string): Promise<void> => {
        if (draft.setups.get(userId)?.sessionId !== sessionId) {
          draft.setups.delete(userId);
        }
        if (draft.registrations.get(userId)?.sessionId !== sessionId) {
          draft.registrations.delete(userId);
        }
        return Promise.resolve();
      },
      dropOfUser: (userId: string): Promise<void> => {
        draft.setups.delete(userId);
        draft.registrations.delete(userId);
        return Promise.resolve();
      },
    };
    const challenges: SignInChallengeRepository = {
      replace: (issue: SignInChallengeIssue): Promise<SignInChallenge> => {
        this.ids += 1;
        const state: SignInChallengeState = {
          ...issue,
          id: fakeId(this.ids),
          assertionChallenge: null,
          assertionExpiresAt: null,
        };
        draft.challenges.set(issue.userId, state);
        return Promise.resolve(SignInChallenge.restore(state));
      },
      findByTokenHash: (tokenHash: string): Promise<SignInChallenge | null> => {
        const found: SignInChallengeState | undefined = [...draft.challenges.values()].find(
          (challenge: SignInChallengeState) => challenge.tokenHash === tokenHash,
        );
        return Promise.resolve(found === undefined ? null : SignInChallenge.restore(found));
      },
      saveAssertion: (challenge: SignInChallenge): Promise<void> => {
        if (draft.challenges.get(challenge.userId)?.id === challenge.id) {
          draft.challenges.set(challenge.userId, challenge.snapshot);
        }
        return Promise.resolve();
      },
      deleteOfUser: (userId: string): Promise<void> => {
        draft.challenges.delete(userId);
        return Promise.resolve();
      },
    };
    return {
      users,
      credentials,
      codes,
      codeRequests,
      signInAttempts,
      resetLinks,
      resetRequests,
      emailChanges,
      events,
      deletionQueue,
      twoStep,
      backupCodes,
      securityKeys,
      pendingTwoStep,
      challenges,
      mayFinishFederatedChallenge: () => Promise.resolve(false),
    };
  }
  // #endregion
}

/**
 * Class FixedClock
 *
 * @description
 * A clock that stays on an instant until a spec moves it.
 */
export class FixedClock implements Clock {
  // #region Properties
  /**
   * Property instant
   *
   * @description
   * The current instant, in milliseconds.
   *
   * @type {number}
   */
  private instant: number;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the clock.
   *
   * @param {string} iso - The first instant, ISO 8601.
   * @constructor
   */
  public constructor(iso: string) {
    this.instant = Date.parse(iso);
  }
  // #endregion

  // #region Methods
  /**
   * Method now
   *
   * @description
   * Returns the current instant.
   *
   * @returns {Date} A new date for it.
   */
  public now(): Date {
    return new Date(this.instant);
  }

  /**
   * Method advance
   *
   * @description
   * Moves the clock forward.
   *
   * @param {number} milliseconds - How far.
   */
  public advance(milliseconds: number): void {
    this.instant += milliseconds;
  }
  // #endregion
}

/**
 * Class FakePasswordHasher
 *
 * @description
 * A hasher whose hash of `p` is `hashed:p`; it records the checks made without a hash.
 */
export class FakePasswordHasher implements PasswordHasher {
  // #region Properties
  /**
   * Property decoyChecks
   *
   * @description
   * Checks made without a stored hash.
   *
   * @type {number}
   */
  public decoyChecks: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method hash
   *
   * @description
   * The fake hash of a password.
   *
   * @param {string} password - The password.
   * @returns {Promise<string>} `hashed:<password>`.
   */
  public hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  /**
   * Method verify
   *
   * @description
   * Compares with the fake hash.
   *
   * @param {string} password - The password.
   * @param {string | null} passwordHash - The stored hash.
   * @returns {Promise<boolean>} Whether it matches.
   */
  public verify(password: string, passwordHash: string | null): Promise<boolean> {
    if (passwordHash === null) {
      this.decoyChecks += 1;
      return Promise.resolve(false);
    }
    return Promise.resolve(passwordHash === `hashed:${password}`);
  }
  // #endregion
}

/**
 * Class FakeCodeSecrets
 *
 * @description
 * Codes drawn from a list, and a readable hash that binds the account and the purpose.
 */
export class FakeCodeSecrets implements OneTimeCodeSecrets {
  // #region Properties
  /**
   * Property codes
   *
   * @description
   * The next codes to draw; `482913` once the list is empty.
   *
   * @type {string[]}
   * @readonly
   */
  private readonly codes: string[];
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the codes to draw, in order.
   *
   * @param {readonly string[]} codes - The codes.
   * @constructor
   */
  public constructor(codes: readonly string[] = []) {
    this.codes = [...codes];
  }
  // #endregion

  // #region Methods
  /**
   * Method generate
   *
   * @description
   * Draws the next code.
   *
   * @returns {string} The code.
   */
  public generate(): string {
    return this.codes.shift() ?? '482913';
  }

  /**
   * Method hash
   *
   * @description
   * The readable fake hash.
   *
   * @param {CodeSubject} subject - The code and what it is for.
   * @returns {string} `<userId>:<purpose>:<code>`.
   */
  public hash(subject: CodeSubject): string {
    return `${subject.userId}:${subject.purpose}:${subject.code}`;
  }
  // #endregion
}

/**
 * Class FakeCompromisedPasswords
 *
 * @description
 * A list of compromised passwords given by the spec.
 */
export class FakeCompromisedPasswords implements CompromisedPasswords {
  // #region Properties
  /**
   * Property passwords
   *
   * @description
   * The compromised passwords.
   *
   * @type {ReadonlySet<string>}
   * @readonly
   */
  private readonly passwords: ReadonlySet<string>;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the list.
   *
   * @param {readonly string[]} passwords - The compromised passwords.
   * @constructor
   */
  public constructor(passwords: readonly string[] = []) {
    this.passwords = new Set(passwords);
  }
  // #endregion

  // #region Methods
  /**
   * Method includes
   *
   * @description
   * Whether a password is in the list.
   *
   * @param {string} password - The password.
   * @returns {Promise<boolean>} Whether it is.
   */
  public includes(password: string): Promise<boolean> {
    return Promise.resolve(this.passwords.has(password));
  }
  // #endregion
}

/**
 * Class FakeSessionOpener
 *
 * @description
 * Opens numbered fake sessions and records whether each was opened inside a unit of work.
 */
export class FakeSessionOpener implements SessionOpener {
  // #region Properties
  /**
   * Property opened
   *
   * @description
   * The requests, with whether a transaction was running.
   *
   * @type {{ readonly request: SessionRequest; readonly inTransaction: boolean }[]}
   * @readonly
   */
  public readonly opened: { readonly request: SessionRequest; readonly inTransaction: boolean }[] =
    [];

  /**
   * Property accounts
   *
   * @description
   * The unit of work whose transaction the session must join.
   *
   * @type {InMemoryAccounts}
   * @readonly
   */
  private readonly accounts: InMemoryAccounts;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the unit of work to watch.
   *
   * @param {InMemoryAccounts} accounts - The unit of work.
   * @constructor
   */
  public constructor(accounts: InMemoryAccounts) {
    this.accounts = accounts;
  }
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens a fake session expiring 30 days after the fixture instant.
   *
   * @param {SessionRequest} request - The session to open.
   * @returns {Promise<OpenedSession>} The session.
   */
  public open(request: SessionRequest): Promise<OpenedSession> {
    this.opened.push({ request, inTransaction: this.accounts.inTransaction });
    return Promise.resolve({
      token: `token-${String(this.opened.length)}`,
      id: `019a6a2e-4b1c-7d3e-8f5a-${String(this.opened.length).padStart(12, '0')}`,
      expiresAt: new Date('2026-12-08T13:07:00Z'),
      persistent: request.persistent,
    });
  }
  // #endregion
}

/**
 * Class FakeDeviceReader
 *
 * @description
 * Reads every `User-Agent` as Firefox 132 on Windows, and a missing one as an unknown device.
 */
export class FakeDeviceReader implements DeviceReader {
  // #region Methods
  /**
   * Method read
   *
   * @description
   * The device of a header.
   *
   * @param {string | null} userAgent - The header.
   * @returns {ClientDevice} The device.
   */
  public read(userAgent: string | null): ClientDevice {
    return userAgent === null
      ? { type: 'unknown', browser: null, browserVersion: null, os: null, osVersion: null }
      : {
          type: 'desktop',
          browser: 'Firefox',
          browserVersion: '132',
          os: 'Windows',
          osVersion: null,
        };
  }
  // #endregion
}

/**
 * Class FakeResetLinkSecrets
 *
 * @description
 * Tokens `reset-token-<n>`, hashed as `hash:<token>`; a token that does not start with
 * `reset-token-` is malformed.
 */
export class FakeResetLinkSecrets implements ResetLinkSecrets {
  // #region Properties
  /**
   * Property issued
   *
   * @description
   * Tokens drawn so far.
   *
   * @type {number}
   */
  public issued: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws the next token.
   *
   * @returns {IssuedResetToken} The token and its hash.
   */
  public issue(): IssuedResetToken {
    this.issued += 1;
    const token: string = `reset-token-${String(this.issued)}`;
    return { token, tokenHash: `hash:${token}` };
  }

  /**
   * Method hashOf
   *
   * @description
   * Hashes a token sent back.
   *
   * @param {string} token - The token.
   * @returns {string | null} Its hash, or `null` when malformed.
   */
  public hashOf(token: string): string | null {
    return token.startsWith('reset-token-') ? `hash:${token}` : null;
  }
  // #endregion
}

/**
 * Class FakeAccountSessions
 *
 * @description
 * The sessions of the accounts, in memory: each session names its person, whether it is open and
 * when its person last proved who they are.
 */
export class FakeAccountSessions implements AccountSessions, TwoStepEnrollments {
  // #region Properties
  /**
   * Property sessions
   *
   * @description
   * Sessions by id, with the method of their last recent authentication.
   *
   * @type {Map<string, { userId: string; open: boolean; authenticatedAt: Date | null; method: 'password' | 'two-step' | null }>}
   */
  public readonly sessions = new Map<
    string,
    {
      userId: string;
      open: boolean;
      authenticatedAt: Date | null;
      method: 'password' | 'two-step' | null;
    }
  >();

  /**
   * Property enrolled
   *
   * @description
   * The accounts the sessions module knows with two-step verification: a recent authentication
   * of theirs counts only by a second factor.
   *
   * @type {Set<string>}
   */
  public readonly enrolled = new Set<string>();

  /**
   * Property erased
   *
   * @description
   * Accounts whose sessions were erased.
   *
   * @type {string[]}
   */
  public readonly erased: string[] = [];

  /**
   * Property clock
   *
   * @description
   * The clock of the spec.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the clock of the spec.
   *
   * @param {Clock} clock - The clock.
   * @constructor
   */
  public constructor(clock: Clock) {
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method seed
   *
   * @description
   * Stores an open session.
   *
   * @param {string} id - Id of the session.
   * @param {string} userId - Its person.
   * @param {Date | null} authenticatedAt - Its last proof of who the person is.
   * @param {'password' | 'two-step' | null} method - How, by password when it has one.
   */
  public seed(
    id: string,
    userId: string,
    authenticatedAt: Date | null,
    method: 'password' | 'two-step' | null = authenticatedAt === null ? null : 'password',
  ): void {
    this.sessions.set(id, { userId, open: true, authenticatedAt, method });
  }

  /**
   * Method record
   *
   * @description
   * Records whether an account has two-step verification (`TwoStepEnrollments`).
   *
   * @param {string} userId - The account.
   * @param {boolean} enabled - Whether it is on.
   * @returns {Promise<void>} Resolves at once.
   */
  public record(userId: string, enabled: boolean): Promise<void> {
    if (enabled) {
      this.enrolled.add(userId);
    } else {
      this.enrolled.delete(userId);
    }
    return Promise.resolve();
  }

  /**
   * Method check
   *
   * @description
   * The status of a session.
   *
   * @param {string} userId - The person.
   * @param {string} sessionId - The session.
   * @returns {Promise<SessionAuthentication>} Its status.
   */
  public check(userId: string, sessionId: string): Promise<SessionAuthentication> {
    const session:
      | {
          userId: string;
          open: boolean;
          authenticatedAt: Date | null;
          method: 'password' | 'two-step' | null;
        }
      | undefined = this.sessions.get(sessionId);
    if (session?.userId !== userId || !session.open) {
      return Promise.resolve('not-found');
    }
    const recent: boolean =
      session.authenticatedAt !== null &&
      this.clock.now().getTime() < session.authenticatedAt.getTime() + 10 * 60_000 &&
      (!this.enrolled.has(userId) || session.method === 'two-step');
    return Promise.resolve(recent ? 'recent' : 'stale');
  }

  /**
   * Method authenticate
   *
   * @description
   * Records a recent authentication.
   *
   * @param {string} userId - The person.
   * @param {string} sessionId - The session.
   * @param {'password' | 'two-step'} method - How.
   * @returns {Promise<RecentAuthentication | null>} The window, or `null`.
   */
  public async authenticate(
    userId: string,
    sessionId: string,
    method: 'password' | 'two-step',
  ): Promise<RecentAuthentication | null> {
    if ((await this.check(userId, sessionId)) === 'not-found') {
      return null;
    }
    const now: Date = this.clock.now();
    this.sessions.set(sessionId, { userId, open: true, authenticatedAt: now, method });
    return { authenticatedAt: now, expiresAt: new Date(now.getTime() + 10 * 60_000) };
  }

  /**
   * Method endRecentAuthentication
   *
   * @description
   * Ends the recent authentication of the open sessions but one.
   *
   * @param {string} userId - The person.
   * @param {string | null} exceptSessionId - The session that keeps its own.
   * @param {'every-window' | 'password-windows'} scope - Every window, or those of a password.
   * @returns {Promise<void>} Resolves at once.
   */
  public endRecentAuthentication(
    userId: string,
    exceptSessionId: string | null,
    scope: 'every-window' | 'password-windows',
  ): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (
        session.userId === userId &&
        session.open &&
        id !== exceptSessionId &&
        (scope === 'every-window' || session.method !== 'two-step')
      ) {
        this.sessions.set(id, { ...session, authenticatedAt: null, method: null });
      }
    }
    return Promise.resolve();
  }

  /**
   * Method revokeAll
   *
   * @description
   * Closes the open sessions but one.
   *
   * @param {string} userId - The person.
   * @param {string | null} exceptSessionId - The session that stays open.
   * @returns {Promise<number>} How many were closed.
   */
  public revokeAll(userId: string, exceptSessionId: string | null): Promise<number> {
    let revoked: number = 0;
    for (const [id, session] of this.sessions) {
      if (session.userId === userId && session.open && id !== exceptSessionId) {
        this.sessions.set(id, { ...session, open: false });
        revoked += 1;
      }
    }
    return Promise.resolve(revoked);
  }

  /**
   * Method countOpen
   *
   * @description
   * Counts the open sessions of a person.
   *
   * @param {string} userId - The person.
   * @returns {Promise<number>} The count.
   */
  public countOpen(userId: string): Promise<number> {
    return Promise.resolve(
      [...this.sessions.values()].filter(
        (session: { userId: string; open: boolean }) => session.userId === userId && session.open,
      ).length,
    );
  }

  /**
   * Method erase
   *
   * @description
   * Deletes the sessions of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves at once.
   */
  public erase(userId: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id);
      }
    }
    this.erased.push(userId);
    return Promise.resolve();
  }
  // #endregion
}

/**
 * Class FakeAccountApiTokens
 *
 * @description
 * Counts the unrevoked personal API tokens of each person.
 */
export class FakeAccountApiTokens implements AccountApiTokens {
  // #region Properties
  /**
   * Property unrevoked
   *
   * @description
   * Unrevoked tokens by person.
   *
   * @type {Map<string, number>}
   */
  public readonly unrevoked = new Map<string, number>();

  /**
   * Property erased
   *
   * @description
   * Accounts whose tokens were erased.
   *
   * @type {string[]}
   */
  public readonly erased: string[] = [];
  // #endregion

  // #region Methods
  /**
   * Method revokeAll
   *
   * @description
   * Revokes every token of a person.
   *
   * @param {string} userId - The person.
   * @returns {Promise<number>} How many were revoked.
   */
  public revokeAll(userId: string): Promise<number> {
    const count: number = this.unrevoked.get(userId) ?? 0;
    this.unrevoked.set(userId, 0);
    return Promise.resolve(count);
  }

  /**
   * Method erase
   *
   * @description
   * Deletes the tokens of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves at once.
   */
  public erase(userId: string): Promise<void> {
    this.unrevoked.delete(userId);
    this.erased.push(userId);
    return Promise.resolve();
  }
  // #endregion
}

/**
 * Class FakeOwnedOrganizations
 *
 * @description
 * The organizations each person owns.
 */
export class FakeOwnedOrganizations implements OwnedOrganizations {
  // #region Properties
  /**
   * Property owned
   *
   * @description
   * Owned organizations by person.
   *
   * @type {Map<string, readonly string[]>}
   */
  public readonly owned = new Map<string, readonly string[]>();
  // #endregion

  // #region Methods
  /**
   * Method find
   *
   * @description
   * The organizations a person owns.
   *
   * @param {string} userId - The person.
   * @returns {Promise<readonly string[]>} Their ids.
   */
  public find(userId: string): Promise<readonly string[]> {
    return Promise.resolve(this.owned.get(userId) ?? []);
  }
  // #endregion
}
