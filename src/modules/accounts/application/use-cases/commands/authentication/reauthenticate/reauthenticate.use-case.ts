import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { PasswordFailure } from '../../../../../domain/policies/password/password-failure.policy.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { CountedPasswordCheck } from '../../../../models/password/counted-password-check.model.js';
import type { RecentAuthentication } from '../../../../models/sessions/recent-authentication.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { PasswordHasher } from '../../../../ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import {
  settlePasswordCheck,
  countPasswordAttempt,
  wrongPasswordRefusal,
} from '../../../../services/password/password-attempts.service.js';
import type { ReauthenticateInput } from './reauthenticate.input.js';

/**
 * Class Reauthenticate
 *
 * @description
 * Confirms the password of a signed-in person and records a recent authentication of the session
 * (`POST /internal/v1/sessions/{sessionId}/reauthentication`, decision 4 of P2c), which opens the
 * 10-minute window of the change of address, the scheduling of the deletion and the creation of a
 * personal API token. In three steps, as the password sign-in:
 *
 * 1. A transaction checks that the session is an open session of the person
 *    (`session.not-found` otherwise), refuses during a lockout of the address of the account
 *    (`auth.account-locked`), counts the attempt as a failure in advance with the failed sign-ins of
 *    the address, reads the hash, and commits.
 * 2. The password is checked outside any transaction. A wrong one keeps its counted failure:
 *    `auth.password-incorrect` with `remainingAttempts`, or `auth.account-locked` for the failure
 *    that used the last attempt. The session stays open either way.
 * 3. For the right password, a second transaction ends the count and records the recent
 *    authentication of the session.
 */
export class Reauthenticate {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transactions of the confirmation.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property hasher
   *
   * @description
   * Checks the password.
   *
   * @type {PasswordHasher}
   * @readonly
   */
  private readonly hasher: PasswordHasher;

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
   * Property clock
   *
   * @description
   * The time of the attempt.
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
   * Takes the ports of the confirmation.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transactions.
   * @param {PasswordHasher} hasher - Checks the password.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {Clock} clock - The time of the attempt.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    sessions: AccountSessions,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
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
   * Confirms the password in the session.
   *
   * @param {ReauthenticateInput} input - The person, the session and the password.
   * @returns {Promise<RecentAuthentication>} The recent authentication and when it ends.
   * @throws {AccountRefusal} `session.not-found`, `auth.account-locked` or
   * `auth.password-incorrect`.
   */
  public async execute(input: ReauthenticateInput): Promise<RecentAuthentication> {
    const now: Date = this.clock.now();
    const attempt: CountedPasswordCheck | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<CountedPasswordCheck | Refusal> => {
        if ((await this.sessions.check(input.actorUserId, input.sessionId)) === 'not-found') {
          return { reason: 'session-not-found' };
        }
        const user: User | null = await store.users.findById(input.actorUserId);
        if (user === null) {
          return { reason: 'session-not-found' };
        }
        const counted: PasswordFailure | Refusal = await countPasswordAttempt(
          store,
          user.email,
          now,
        );
        if ('reason' in counted) {
          return counted;
        }
        return {
          failure: counted,
          email: user.email,
          passwordHash: await store.credentials.findHash(user.id),
        };
      },
    );
    if ('reason' in attempt) {
      throw new AccountRefusal(attempt);
    }
    if (!(await this.hasher.verify(input.password, attempt.passwordHash))) {
      throw new AccountRefusal(wrongPasswordRefusal(attempt.failure));
    }
    const recent: RecentAuthentication | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<RecentAuthentication | Refusal> => {
        const user: User | 'account-gone' | 'password-moved' = await settlePasswordCheck(
          store,
          input.actorUserId,
          attempt.email,
          attempt.passwordHash,
        );
        if (user === 'account-gone') {
          return { reason: 'session-not-found' };
        }
        if (user === 'password-moved') {
          return wrongPasswordRefusal(attempt.failure);
        }
        return (
          (await this.sessions.authenticate(input.actorUserId, input.sessionId)) ?? {
            reason: 'session-not-found',
          }
        );
      },
    );
    if ('reason' in recent) {
      throw new AccountRefusal(recent);
    }
    return recent;
  }
  // #endregion
}
