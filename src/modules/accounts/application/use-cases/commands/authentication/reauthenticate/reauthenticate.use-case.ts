import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { TwoStepVerification } from '../../../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import type { PasswordFailure } from '../../../../../domain/policies/password/password-failure.policy.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { CountedPasswordCheck } from '../../../../models/password/counted-password-check.model.js';
import type { RecentAuthentication } from '../../../../models/sessions/recent-authentication.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { PasswordHasher } from '../../../../ports/outbound/security/authentication/password-hasher.port.js';
import type { AuthenticatorAppSecrets } from '../../../../ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import type { Totp } from '../../../../ports/outbound/security/two-step/totp.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import {
  settlePasswordCheck,
  countPasswordAttempt,
  wrongPasswordRefusal,
} from '../../../../services/password/password-attempts.service.js';
import {
  lockoutRefusal,
  refuseWrongAnswer,
} from '../../../../services/two-step/challenge-answers.service.js';
import type { ReauthenticateInput } from './reauthenticate.input.js';

/**
 * Class Reauthenticate
 *
 * @description
 * Confirms who the person of a session is and records a recent authentication of the session
 * (`POST /internal/v1/sessions/{sessionId}/reauthentication`, decisions 4 and 7 of P2c), which
 * opens the 10-minute window of the guarded routes. An account without two-step verification
 * answers with its password, in three steps, as the password sign-in:
 *
 * 1. A transaction checks that the session is an open session of the person
 *    (`session.not-found` otherwise), refuses a password for an account with two-step verification
 *    (`auth.reauthentication-required` with `methods: [authenticator-app]`, neither checked nor
 *    counted), refuses during a lockout of the address of the account (`auth.account-locked`),
 *    counts the attempt as a failure in advance with the failed sign-ins of the address, reads the
 *    hash, and commits.
 * 2. The password is checked outside any transaction. A wrong one keeps its counted failure:
 *    `auth.password-incorrect` with `remainingAttempts`, or `auth.account-locked` for the failure
 *    that used the last attempt. The session stays open either way.
 * 3. For the right password, a second transaction ends the count and records the recent
 *    authentication of the session, by password.
 *
 * An account with two-step verification answers with a code of its authenticator app, in one
 * transaction: the session first, then the account and its two-step verification locked
 * (`auth.two-step-not-enabled` without), refused during its lockout (`auth.two-step-locked`); a
 * wrong code, or one of a time step already accepted, counts with the wrong answers of its sign-in
 * challenges and commits (`auth.two-step-code-invalid`, or `auth.two-step-locked` for the fifth);
 * the right one is accepted once and records the recent authentication, by a second factor.
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
   * Property appSecrets
   *
   * @description
   * Opens the sealed secret of the authenticator app.
   *
   * @type {AuthenticatorAppSecrets}
   * @readonly
   */
  private readonly appSecrets: AuthenticatorAppSecrets;

  /**
   * Property totp
   *
   * @description
   * Checks the code of the app.
   *
   * @type {Totp}
   * @readonly
   */
  private readonly totp: Totp;

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
   * @param {AuthenticatorAppSecrets} appSecrets - Opens the sealed secret of the app.
   * @param {Totp} totp - Checks the code of the app.
   * @param {Clock} clock - The time of the attempt.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    sessions: AccountSessions,
    appSecrets: AuthenticatorAppSecrets,
    totp: Totp,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.hasher = hasher;
    this.sessions = sessions;
    this.appSecrets = appSecrets;
    this.totp = totp;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Confirms the password or the code in the session.
   *
   * @param {ReauthenticateInput} input - The person, the session and the password or the code.
   * @returns {Promise<RecentAuthentication>} The recent authentication and when it ends.
   * @throws {AccountRefusal} `session.not-found`, `auth.reauthentication-required`,
   * `auth.two-step-not-enabled`, `auth.account-locked`, `auth.password-incorrect`,
   * `auth.two-step-locked` or `auth.two-step-code-invalid`.
   */
  public async execute(input: ReauthenticateInput): Promise<RecentAuthentication> {
    if (input.code !== null) {
      return this.withCode(input.actorUserId, input.sessionId, input.code);
    }
    if (input.password === null) {
      throw new Error('A reauthentication carries a password or a code.');
    }
    return this.withPassword(input.actorUserId, input.sessionId, input.password);
  }

  /**
   * Method withPassword
   *
   * @description
   * The three steps of the password, for an account without two-step verification.
   *
   * @param {string} actorUserId - The person.
   * @param {string} sessionId - The session.
   * @param {string} password - The password, as typed.
   * @returns {Promise<RecentAuthentication>} The recent authentication.
   * @throws {AccountRefusal} The refusal of the password.
   */
  private async withPassword(
    actorUserId: string,
    sessionId: string,
    password: string,
  ): Promise<RecentAuthentication> {
    const now: Date = this.clock.now();
    const attempt: CountedPasswordCheck | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<CountedPasswordCheck | Refusal> => {
        if ((await this.sessions.check(actorUserId, sessionId)) === 'not-found') {
          return { reason: 'session-not-found' };
        }
        const user: User | null = await store.users.findById(actorUserId);
        if (user === null) {
          return { reason: 'session-not-found' };
        }
        if ((await store.twoStep.find(user.id)) !== null) {
          return { reason: 'reauthentication-required', methods: ['authenticator-app'] };
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
    if (!(await this.hasher.verify(password, attempt.passwordHash))) {
      throw new AccountRefusal(wrongPasswordRefusal(attempt.failure));
    }
    const recent: RecentAuthentication | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<RecentAuthentication | Refusal> => {
        const user: User | 'account-gone' | 'password-moved' = await settlePasswordCheck(
          store,
          actorUserId,
          attempt.email,
          attempt.passwordHash,
        );
        if (user === 'account-gone') {
          return { reason: 'session-not-found' };
        }
        if (user === 'password-moved') {
          return wrongPasswordRefusal(attempt.failure);
        }
        if ((await store.twoStep.find(user.id)) !== null) {
          return { reason: 'reauthentication-required', methods: ['authenticator-app'] };
        }
        return (
          (await this.sessions.authenticate(actorUserId, sessionId, 'password')) ?? {
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

  /**
   * Method withCode
   *
   * @description
   * The transaction of a code of the app, for an account with two-step verification. A wrong code
   * commits its count before the refusal is thrown.
   *
   * @param {string} actorUserId - The person.
   * @param {string} sessionId - The session.
   * @param {string} code - The 6 digits, as typed.
   * @returns {Promise<RecentAuthentication>} The recent authentication.
   * @throws {AccountRefusal} The refusal of the code.
   */
  private async withCode(
    actorUserId: string,
    sessionId: string,
    code: string,
  ): Promise<RecentAuthentication> {
    const now: Date = this.clock.now();
    const recent: RecentAuthentication | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<RecentAuthentication | Refusal> => {
        const user: User | null = await store.users.lock(actorUserId);
        if (user === null || (await this.sessions.check(user.id, sessionId)) === 'not-found') {
          return { reason: 'session-not-found' };
        }
        const verification: TwoStepVerification | null = await store.twoStep.lock(user.id);
        if (verification === null) {
          return { reason: 'two-step-not-enabled' };
        }
        const locked: Refusal | null = lockoutRefusal(verification, now);
        if (locked !== null) {
          return locked;
        }
        const timeStep: number | null = await this.totp.verify(
          this.appSecrets.open(user.id, verification.sealedSecret),
          code,
          now,
          verification.lastAcceptedTimeStep,
        );
        if (timeStep === null) {
          return refuseWrongAnswer(store, verification, now, 'two-step-code-invalid');
        }
        await store.twoStep.update(verification.recordRightAnswer(timeStep));
        return (
          (await this.sessions.authenticate(user.id, sessionId, 'two-step')) ?? {
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
