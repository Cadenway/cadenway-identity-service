import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { PasswordFailure } from '../../../../../domain/policies/password/password-failure.policy.js';
import { toAccountView } from '../../../../mappers/accounts/account-view.mapper.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { CountedPasswordCheck } from '../../../../models/password/counted-password-check.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { CompromisedPasswords } from '../../../../ports/outbound/security/authentication/compromised-passwords.port.js';
import type { PasswordHasher } from '../../../../ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { AccountView } from '../../../../projections/accounts/account-view.projection.js';
import { dropPendingEmailChange } from '../../../../services/email-change/pending-email-change.service.js';
import {
  settlePasswordCheck,
  countPasswordAttempt,
  refuseNewPassword,
  wrongPasswordRefusal,
} from '../../../../services/password/password-attempts.service.js';
import type { ChangePasswordInput } from './change-password.input.js';

/**
 * Class ChangePassword
 *
 * @description
 * Replaces the password of the actor from a session (`PUT /internal/v1/users/{userId}/password`,
 * decision 3 of P2c, "Vos autres sessions resteront ouvertes."). The checks run in this order:
 *
 * 1. The account of the path is the actor (`user.not-found`) and the session is an open session of
 *    the actor (`session.not-found`).
 * 2. The new password, against the rules of the sign-up (`auth.password-too-short`,
 *    `auth.password-compromised`), without counting an attempt.
 * 3. The current password, counted with the failed sign-ins of the address of the account, as the
 *    re-authentication does (`auth.password-incorrect`, `auth.account-locked`); the hash is checked
 *    outside any transaction.
 *
 * Then, in one transaction: the count ends, the session records a recent authentication, the hash
 * and `passwordChangedAt` change with the next version of the account, a pending change of address
 * is dropped, the other sessions stay open but lose their recent authentication, and
 * `user.password-changed.v1` (`method: change`, no closed session) is appended.
 */
export class ChangePassword {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transactions of the change.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property hasher
   *
   * @description
   * Checks the current password and hashes the new one.
   *
   * @type {PasswordHasher}
   * @readonly
   */
  private readonly hasher: PasswordHasher;

  /**
   * Property compromised
   *
   * @description
   * The list of compromised passwords.
   *
   * @type {CompromisedPasswords}
   * @readonly
   */
  private readonly compromised: CompromisedPasswords;

  /**
   * Property sessions
   *
   * @description
   * The sessions of the person.
   *
   * @type {AccountSessions}
   * @readonly
   */
  private readonly sessions: AccountSessions;

  /**
   * Property devices
   *
   * @description
   * Reads the device of the browser for the e-mail.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

  /**
   * Property clock
   *
   * @description
   * The time of the change.
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
   * Takes the ports of the change.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transactions.
   * @param {PasswordHasher} hasher - Checks and hashes passwords.
   * @param {CompromisedPasswords} compromised - The list of compromised passwords.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {Clock} clock - The time of the change.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    compromised: CompromisedPasswords,
    sessions: AccountSessions,
    devices: DeviceReader,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.hasher = hasher;
    this.compromised = compromised;
    this.sessions = sessions;
    this.devices = devices;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Changes the password.
   *
   * @param {ChangePasswordInput} input - The person, the session and both passwords.
   * @returns {Promise<AccountView>} The account after the change.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `auth.password-too-short`,
   * `auth.password-compromised`, `auth.password-incorrect` or `auth.account-locked`.
   */
  public async execute(input: ChangePasswordInput): Promise<AccountView> {
    if (input.actorUserId !== input.userId) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    const located: Refusal | null = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<Refusal | null> => {
        if ((await store.users.findById(input.userId)) === null) {
          return { reason: 'user-not-found' };
        }
        return (await this.sessions.check(input.userId, input.sessionId)) === 'not-found'
          ? { reason: 'session-not-found' }
          : null;
      },
    );
    const refused: Refusal | null =
      located ?? (await refuseNewPassword(this.compromised, input.newPassword));
    if (refused !== null) {
      throw new AccountRefusal(refused);
    }
    const attempt: CountedPasswordCheck | Refusal = await this.unitOfWork.run(
      (store: AccountsStore): Promise<CountedPasswordCheck | Refusal> =>
        this.count(store, input.userId),
    );
    if ('reason' in attempt) {
      throw new AccountRefusal(attempt);
    }
    if (!(await this.hasher.verify(input.currentPassword, attempt.passwordHash))) {
      throw new AccountRefusal(wrongPasswordRefusal(attempt.failure));
    }
    const passwordHash: string = await this.hasher.hash(input.newPassword);
    const outcome: AccountView | Refusal = await this.unitOfWork.run(
      (store: AccountsStore): Promise<AccountView | Refusal> =>
        this.change(store, input, attempt, passwordHash),
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }

  /**
   * Method count
   *
   * @description
   * The transaction that counts the check of the current password as a failure in advance.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {string} userId - The account.
   * @returns {Promise<CountedPasswordCheck | Refusal>} The counted check, `user.not-found` or
   * `auth.account-locked`.
   */
  private async count(
    store: AccountsStore,
    userId: string,
  ): Promise<CountedPasswordCheck | Refusal> {
    const user: User | null = await store.users.findById(userId);
    if (user === null) {
      return { reason: 'user-not-found' };
    }
    const counted: PasswordFailure | Refusal = await countPasswordAttempt(
      store,
      user.email,
      this.clock.now(),
    );
    if ('reason' in counted) {
      return counted;
    }
    return {
      failure: counted,
      email: user.email,
      passwordHash: await store.credentials.findHash(user.id),
    };
  }

  /**
   * Method change
   *
   * @description
   * The transaction that applies the change once the current password is right.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {ChangePasswordInput} input - The request.
   * @param {CountedPasswordCheck} attempt - The counted check.
   * @param {string} passwordHash - The hash of the new password.
   * @returns {Promise<AccountView | Refusal>} The account after the change, or `user.not-found` or
   * `session.not-found` when it ended meanwhile, with the count ended.
   */
  private async change(
    store: AccountsStore,
    input: ChangePasswordInput,
    attempt: CountedPasswordCheck,
    passwordHash: string,
  ): Promise<AccountView | Refusal> {
    const now: Date = this.clock.now();
    const user: User | 'account-gone' | 'password-moved' = await settlePasswordCheck(
      store,
      input.userId,
      attempt.email,
      attempt.passwordHash,
    );
    if (user === 'account-gone') {
      return { reason: 'user-not-found' };
    }
    if (user === 'password-moved') {
      return wrongPasswordRefusal(attempt.failure);
    }
    if ((await this.sessions.authenticate(input.userId, input.sessionId)) === null) {
      return { reason: 'session-not-found' };
    }
    const changed: User = user.changePassword(now);
    await store.credentials.save(user.id, passwordHash);
    await store.users.update(changed);
    await dropPendingEmailChange(store, user.id, now);
    await this.sessions.endRecentAuthentication(user.id, input.sessionId);
    await store.events.userPasswordChanged(
      changed,
      'change',
      0,
      toClientDescription(this.devices, input.client),
    );
    return toAccountView(changed);
  }
  // #endregion
}
