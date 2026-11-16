import type { UserRegistration } from '../../../domain/aggregates/account/user-registration.aggregate.js';
import { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { OneTimeCodeIssue } from '../../../domain/aggregates/one-time-codes/one-time-code-issue.aggregate.js';
import type { OneTimeCodeState } from '../../../domain/aggregates/one-time-codes/one-time-code-state.aggregate.js';
import { OneTimeCode } from '../../../domain/aggregates/one-time-codes/one-time-code.aggregate.js';
import { CodeRequestThrottle } from '../../../domain/policies/one-time-codes/code-request-throttle.policy.js';
import { PasswordLockout } from '../../../domain/policies/password/password-lockout.policy.js';
import { EmailAddress } from '../../../domain/value-objects/email/email-address.value-object.js';
import type { OneTimeCodePurpose } from '../../../domain/value-objects/one-time-code-purpose/one-time-code-purpose.value-object.js';
import type { Clock } from '../../ports/outbound/clock/accounts/clock.port.js';
import type { SessionOpener } from '../../ports/outbound/identity/sessions/session-opener.port.js';
import type { AccountEvents } from '../../ports/outbound/messaging/accounts/account-events.port.js';
import type { CodeRequestRepository } from '../../ports/outbound/persistence/accounts/code-request-repository.port.js';
import type { OneTimeCodeRepository } from '../../ports/outbound/persistence/accounts/one-time-code-repository.port.js';
import type { PasswordCredentialRepository } from '../../ports/outbound/persistence/accounts/password-credential-repository.port.js';
import type { SignInAttemptRepository } from '../../ports/outbound/persistence/accounts/sign-in-attempt-repository.port.js';
import type { UserRepository } from '../../ports/outbound/persistence/accounts/user-repository.port.js';
import type { CompromisedPasswords } from '../../ports/outbound/security/authentication/compromised-passwords.port.js';
import type { OneTimeCodeSecrets } from '../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { PasswordHasher } from '../../ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { CodeSubject } from '../authentication/code-subject.model.js';
import type { IssuedCode } from '../authentication/issued-code.model.js';
import type { OpenedSession } from '../sessions/opened-session.model.js';
import type { SessionRequest } from '../sessions/session-request.model.js';
import type { AccountsStore } from '../transactions/accounts-store.model.js';

/**
 * Type RecordedEvent
 *
 * @description
 * An event a use case appended, as the fake outbox keeps it.
 *
 * @type {{ readonly name: 'user.signed-up.v1' | 'user.email-verified.v1'; readonly user: User } | { readonly name: 'one-time-code.issued.v1'; readonly issued: IssuedCode }}
 */
export type RecordedEvent =
  | { readonly name: 'user.signed-up.v1' | 'user.email-verified.v1'; readonly user: User }
  | { readonly name: 'one-time-code.issued.v1'; readonly issued: IssuedCode };

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
   * @returns {User} The account.
   */
  public seedUser(email: string, verified: boolean, passwordHash: string): User {
    this.ids += 1;
    const user: User = User.restore({
      id: fakeId(this.ids),
      email: EmailAddress.of(email),
      name: 'Camille Martin',
      language: 'fr',
      emailVerifiedAt: verified ? new Date('2026-11-08T12:00:00Z') : null,
      version: verified ? 2 : 1,
      signUpCount: 1,
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
      insert: (registration: UserRegistration): Promise<User> => {
        this.ids += 1;
        const user: User = User.restore({
          ...registration,
          id: fakeId(this.ids),
          emailVerifiedAt: null,
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
      oneTimeCodeIssued: (issued: IssuedCode): Promise<void> => {
        draft.events.push({ name: 'one-time-code.issued.v1', issued });
        return Promise.resolve();
      },
    };
    return { users, credentials, codes, codeRequests, signInAttempts, events };
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
