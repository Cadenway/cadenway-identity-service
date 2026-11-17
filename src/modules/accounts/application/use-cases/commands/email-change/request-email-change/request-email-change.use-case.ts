import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { EmailUnchangedError } from '../../../../../domain/errors/accounts/email-unchanged.error.js';
import type { AcceptedCodeRequest } from '../../../../../domain/policies/one-time-codes/accepted-code-request.policy.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { SessionAuthentication } from '../../../../models/sessions/session-authentication.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { OneTimeCodeSecrets } from '../../../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { CodeSentView } from '../../../../projections/authentication/code-sent-view.projection.js';
import {
  acceptCodeRequest,
  issueOneTimeCode,
} from '../../../../services/authentication/one-time-codes.service.js';
import type { RequestEmailChangeInput } from './request-email-change.input.js';

/**
 * Class RequestEmailChange
 *
 * @description
 * Records a pending change of address of the actor and issues an `email-change` code to the new
 * address, valid 15 minutes (`POST /internal/v1/users/{userId}/email-change`, decision 5 of P2c).
 * The checks run in this order, each refusal leaving nothing written:
 *
 * 1. The account of the path is the actor (`user.not-found`) and the session is an open session of
 *    the actor (`session.not-found`).
 * 2. The recent authentication of the session (`auth.reauthentication-required`, decision 4).
 * 3. The new address is not the current one (`auth.email-unchanged`).
 * 4. No verified account uses the new address (`auth.email-taken`); an unverified sign-up of it does
 *    not count.
 * 5. The throttle of the code requests of the new address, shared with its other codes
 *    (`auth.code-throttled`).
 *
 * The change belongs to the session: a new request replaces the pending change and its code. The
 * current address stays the address of the account until the confirmation.
 */
export class RequestEmailChange {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the request.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property secrets
   *
   * @description
   * Draws and hashes the code.
   *
   * @type {OneTimeCodeSecrets}
   * @readonly
   */
  private readonly secrets: OneTimeCodeSecrets;

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
   * The time of the request.
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
   * Takes the ports of the request.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction.
   * @param {OneTimeCodeSecrets} secrets - Draws and hashes the code.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {Clock} clock - The time of the request.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    sessions: AccountSessions,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.sessions = sessions;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Asks for the change and sends the code to the new address.
   *
   * @param {RequestEmailChangeInput} input - The person, the session and the new address.
   * @returns {Promise<CodeSentView>} The new address, the expiry of the code and when another can
   * be asked.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`,
   * `auth.reauthentication-required`, `auth.email-unchanged`, `auth.email-taken` or
   * `auth.code-throttled`.
   */
  public async execute(input: RequestEmailChangeInput): Promise<CodeSentView> {
    if (input.actorUserId !== input.userId) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    const email: EmailAddress = EmailAddress.of(input.email);
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: AccountsStore): Promise<CodeSentView> => {
      const user: User | null = await store.users.lock(input.userId);
      if (user === null) {
        throw new AccountRefusal({ reason: 'user-not-found' });
      }
      const authentication: SessionAuthentication = await this.sessions.check(
        input.userId,
        input.sessionId,
      );
      if (authentication !== 'recent') {
        throw new AccountRefusal({
          reason: authentication === 'stale' ? 'reauthentication-required' : 'session-not-found',
        });
      }
      RequestEmailChange.assertNewEmail(user, email);
      if ((await store.users.findByEmail(email, false))?.isVerified === true) {
        throw new AccountRefusal({ reason: 'email-taken' });
      }
      const accepted: AcceptedCodeRequest | Refusal = acceptCodeRequest(
        await store.codeRequests.lock(email),
        now,
      );
      if ('reason' in accepted) {
        throw new AccountRefusal(accepted);
      }
      await store.codeRequests.save(email, accepted.throttle);
      await store.emailChanges.save({ userId: user.id, sessionId: input.sessionId, email });
      const expiresAt: Date = await issueOneTimeCode(
        store,
        this.secrets,
        user,
        'email-change',
        now,
        email,
      );
      return { email: email.value, expiresAt, resendAvailableAt: accepted.resendAvailableAt };
    });
  }

  /**
   * Method assertNewEmail
   *
   * @description
   * Refuses a change to the current address of the account.
   *
   * @param {User} user - The account.
   * @param {EmailAddress} email - The new address.
   * @throws {AccountRefusal} `auth.email-unchanged`.
   */
  private static assertNewEmail(user: User, email: EmailAddress): void {
    try {
      user.assertNewEmail(email);
    } catch (error) {
      if (error instanceof EmailUnchangedError) {
        throw new AccountRefusal({ reason: 'email-unchanged' });
      }
      throw error;
    }
  }
  // #endregion
}
