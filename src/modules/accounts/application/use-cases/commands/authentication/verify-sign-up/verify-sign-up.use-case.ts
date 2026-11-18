import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { SignUpReplacedError } from '../../../../../domain/errors/accounts/sign-up-replaced.error.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { SignUpPasswordCheck } from '../../../../../domain/value-objects/password/sign-up-password-check.value-object.js';
import { toAccountView } from '../../../../mappers/accounts/account-view.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { OpenedSession } from '../../../../models/sessions/opened-session.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { SessionOpener } from '../../../../ports/outbound/identity/sessions/session-opener.port.js';
import type { OneTimeCodeSecrets } from '../../../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { PasswordHasher } from '../../../../ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { SessionIssuedView } from '../../../../projections/authentication/session-issued-view.projection.js';
import { checkOneTimeCode } from '../../../../services/authentication/one-time-codes.service.js';
import type { VerifySignUpInput } from './verify-sign-up.input.js';

/**
 * Interface PendingSignUp
 *
 * @description
 * A pending account whose right code was used by the first transaction of a verification with a
 * password, with what the check of that password needs.
 */
interface PendingSignUp {
  // #region Properties
  /**
   * Property pending
   *
   * @description
   * The unverified account, as the first transaction read it.
   *
   * @type {User}
   * @readonly
   */
  readonly pending: User;

  /**
   * Property passwordHash
   *
   * @description
   * The stored hash of the password of its latest sign-up, or `null` when it has none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly passwordHash: string | null;
  // #endregion
}

/**
 * Function signUpRefusal
 *
 * @description
 * Whether a verification with the right code proves the latest sign-up of the account, as the
 * domain decides (`User.assertProvesSignUp`), mapped to the refusal of the contract.
 *
 * @param {User} user - The unverified account.
 * @param {SignUpPasswordCheck} password - What the verification says of the password.
 * @returns {Refusal | null} `auth.sign-up-replaced`, or `null` when the sign-up is proven.
 */
function signUpRefusal(user: User, password: SignUpPasswordCheck): Refusal | null {
  try {
    user.assertProvesSignUp(password);
    return null;
  } catch (error) {
    if (error instanceof SignUpReplacedError) {
      return { reason: 'sign-up-replaced' };
    }
    throw error;
  }
}

/**
 * Class VerifySignUp
 *
 * @description
 * Checks the `email-verification` code of an unverified account, then the password of its latest
 * sign-up, verifies its address and opens a session (`POST /internal/v1/auth/sign-up/verification`,
 * `@cadenway/contracts` 0.4.0), appending `user.email-verified.v1`. The checks run in this order:
 *
 * 1. The code, under the lock of the account. An address without an unverified account answers like
 *    a wrong code (`auth.code-invalid`); a code that no longer works answers `auth.code-expired`. A
 *    wrong code stays counted: the refusal is thrown after the commit. Whatever `password` holds,
 *    these refusals come first, so `auth.sign-up-replaced` tells nothing to a caller without the
 *    code. The right code is used up by this check: it never works again, whatever follows.
 * 2. Without `password`, in the same transaction: an account signed up once is verified by its code
 *    alone; one whose pending sign-up was replaced by a later accepted sign-up answers
 *    `auth.sign-up-replaced`, committed with the used code.
 * 3. With `password`, the first transaction commits the used code and reads the hash of the latest
 *    sign-up; the password is checked outside any transaction, as the password sign-in does, so the
 *    hash computation never holds a connection or a lock. A different password answers
 *    `auth.sign-up-replaced`. For the right one, a second transaction locks the account again and
 *    verifies it, unless a sign-up replaced it meanwhile (`auth.sign-up-replaced` too) or another
 *    code verified it (`auth.code-invalid`, as for any verified address). Since the code is used
 *    up first, a failure after the first transaction leaves the person to ask for a new code.
 */
export class VerifySignUp {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transactions of the verification.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property secrets
   *
   * @description
   * Hashes the candidate.
   *
   * @type {OneTimeCodeSecrets}
   * @readonly
   */
  private readonly secrets: OneTimeCodeSecrets;

  /**
   * Property hasher
   *
   * @description
   * Checks the password of the sign-up.
   *
   * @type {PasswordHasher}
   * @readonly
   */
  private readonly hasher: PasswordHasher;

  /**
   * Property sessions
   *
   * @description
   * Opens the session.
   *
   * @type {SessionOpener}
   * @readonly
   */
  private readonly sessions: SessionOpener;

  /**
   * Property clock
   *
   * @description
   * The time of the verification.
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
   * Takes the ports of the verification.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transactions of the verification.
   * @param {OneTimeCodeSecrets} secrets - Hashes the candidate.
   * @param {PasswordHasher} hasher - Checks the password of the sign-up.
   * @param {SessionOpener} sessions - Opens the session.
   * @param {Clock} clock - The time of the verification.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    hasher: PasswordHasher,
    sessions: SessionOpener,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.hasher = hasher;
    this.sessions = sessions;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Verifies the address and signs the account in.
   *
   * @param {VerifySignUpInput} input - The code, the password of the sign-up when sent, and the
   * browser.
   * @returns {Promise<SessionIssuedView>} The session, its token and the verified account.
   * @throws {AccountRefusal} `auth.code-invalid`, `auth.code-expired` or `auth.sign-up-replaced`.
   */
  public async execute(input: VerifySignUpInput): Promise<SessionIssuedView> {
    const email: EmailAddress = EmailAddress.of(input.email);
    const now: Date = this.clock.now();
    const outcome: SessionIssuedView | Refusal =
      input.password === undefined
        ? await this.verifyByCode(email, input, now)
        : await this.verifyWithPassword(email, input.password, input, now);
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }

  /**
   * Method verifyByCode
   *
   * @description
   * The verification without a password, in one transaction: the code, then whether the account was
   * signed up once.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {VerifySignUpInput} input - The code and the browser.
   * @param {Date} now - The instant of the verification.
   * @returns {Promise<SessionIssuedView | Refusal>} The session, or the refusal to throw once
   * committed.
   */
  private async verifyByCode(
    email: EmailAddress,
    input: VerifySignUpInput,
    now: Date,
  ): Promise<SessionIssuedView | Refusal> {
    return this.unitOfWork.run(
      async (store: AccountsStore): Promise<SessionIssuedView | Refusal> => {
        const checked: User | Refusal = await this.checkCode(store, email, input.code, now);
        if ('reason' in checked) {
          return checked;
        }
        return this.verify(store, checked, 'not-sent', input, now);
      },
    );
  }

  /**
   * Method verifyWithPassword
   *
   * @description
   * The verification with a password: the code in a first transaction, the password outside any
   * transaction, then the verification in a second one if the account is still the pending sign-up
   * whose password was checked.
   *
   * @param {EmailAddress} email - The normalized address.
   * @param {string} password - The password of the sign-up, as sent; never logged.
   * @param {VerifySignUpInput} input - The code and the browser.
   * @param {Date} now - The instant of the verification.
   * @returns {Promise<SessionIssuedView | Refusal>} The session, or the refusal to throw.
   */
  private async verifyWithPassword(
    email: EmailAddress,
    password: string,
    input: VerifySignUpInput,
    now: Date,
  ): Promise<SessionIssuedView | Refusal> {
    const checked: PendingSignUp | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<PendingSignUp | Refusal> => {
        const user: User | Refusal = await this.checkCode(store, email, input.code, now);
        if ('reason' in user) {
          return user;
        }
        return { pending: user, passwordHash: await store.credentials.findHash(user.id) };
      },
    );
    if ('reason' in checked) {
      return checked;
    }
    const matches: boolean = await this.hasher.verify(password, checked.passwordHash);
    const refused: Refusal | null = signUpRefusal(checked.pending, matches ? 'matches' : 'differs');
    if (refused !== null) {
      return refused;
    }
    return this.unitOfWork.run(
      async (store: AccountsStore): Promise<SessionIssuedView | Refusal> => {
        const current: User | null = await store.users.findByEmail(email, true);
        // Another code verified the account meanwhile: a verified address awaits no code.
        if (current === null || current.isVerified) {
          return { reason: 'code-invalid' };
        }
        // A sign-up between the two transactions replaced the password the check proved.
        if (current.version !== checked.pending.version) {
          return { reason: 'sign-up-replaced' };
        }
        return this.verify(store, current, 'matches', input, now);
      },
    );
  }

  /**
   * Method checkCode
   *
   * @description
   * Locks the unverified account of the address and checks the candidate against its current
   * `email-verification` code, storing the counted attempt or the use of the code.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {EmailAddress} email - The normalized address.
   * @param {string} code - The 6 digits typed; never logged.
   * @param {Date} now - The instant of the check.
   * @returns {Promise<User | Refusal>} The locked account once its right code is used, or
   * `auth.code-invalid` or `auth.code-expired`.
   */
  private async checkCode(
    store: AccountsStore,
    email: EmailAddress,
    code: string,
    now: Date,
  ): Promise<User | Refusal> {
    const user: User | null = await store.users.findByEmail(email, true);
    if (user === null || user.isVerified) {
      return { reason: 'code-invalid' };
    }
    const refusal: Refusal | null = await checkOneTimeCode(
      store,
      this.secrets,
      user,
      'email-verification',
      code,
      now,
    );
    return refusal ?? user;
  }

  /**
   * Method verify
   *
   * @description
   * Verifies the locked account once the verification proves its latest sign-up, appends
   * `user.email-verified.v1` and opens the session in the same transaction.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {User} user - The unverified account, locked.
   * @param {SignUpPasswordCheck} password - What the verification says of the password.
   * @param {VerifySignUpInput} input - The browser and whether the session outlives it.
   * @param {Date} now - The instant of the verification.
   * @returns {Promise<SessionIssuedView | Refusal>} The session, or `auth.sign-up-replaced`.
   */
  private async verify(
    store: AccountsStore,
    user: User,
    password: SignUpPasswordCheck,
    input: VerifySignUpInput,
    now: Date,
  ): Promise<SessionIssuedView | Refusal> {
    const refused: Refusal | null = signUpRefusal(user, password);
    if (refused !== null) {
      return refused;
    }
    const verified: User = user.verifyEmail(now, password);
    await store.users.update(verified);
    await store.events.userEmailVerified(verified);
    const session: OpenedSession = await this.sessions.open({
      userId: verified.id,
      persistent: input.rememberMe,
      client: input.client,
      newDeviceNotice: null,
    });
    return { session, user: toAccountView(verified), deletionCancelled: false };
  }
  // #endregion
}
