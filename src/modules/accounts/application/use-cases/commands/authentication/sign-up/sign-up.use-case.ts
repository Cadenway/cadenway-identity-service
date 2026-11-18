import { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { PasswordTooShortError } from '../../../../../domain/errors/password/password-too-short.error.js';
import type { AcceptedCodeRequest } from '../../../../../domain/policies/one-time-codes/accepted-code-request.policy.js';
import type { CodeRequestThrottle } from '../../../../../domain/policies/one-time-codes/code-request-throttle.policy.js';
import { assertAcceptablePassword } from '../../../../../domain/policies/password/password.policy.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { CompromisedPasswords } from '../../../../ports/outbound/security/authentication/compromised-passwords.port.js';
import type { OneTimeCodeSecrets } from '../../../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { PasswordHasher } from '../../../../ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { CodeSentView } from '../../../../projections/authentication/code-sent-view.projection.js';
import {
  acceptCodeRequest,
  issueOneTimeCode,
} from '../../../../services/authentication/one-time-codes.service.js';
import type { SignUpInput } from './sign-up.input.js';

/**
 * Class SignUp
 *
 * @description
 * Creates an unverified account, or replaces the name and password of an account whose address is
 * not verified yet, and issues an `email-verification` code (`POST /internal/v1/auth/sign-up`).
 *
 * Refusals, in this order, and nothing is written for any of them: `auth.terms-not-accepted`,
 * `auth.password-too-short`, `auth.password-compromised`, `auth.email-taken` (a verified account
 * uses the address), `auth.code-throttled` (a code was asked for the address less than 30 seconds
 * ago, or 5 times in the hour). Otherwise one transaction stores the account, its password hash,
 * the throttle and the code, and appends
 * `user.signed-up.v1` and `one-time-code.issued.v1`. The password is hashed before the
 * transaction, so the hash computation never holds a connection or a lock.
 */
export class SignUp {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the sign-up.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property hasher
   *
   * @description
   * Hashes the password.
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
   * Property clock
   *
   * @description
   * The time of the sign-up.
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
   * Takes the ports of the sign-up.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the sign-up.
   * @param {PasswordHasher} hasher - Hashes the password.
   * @param {CompromisedPasswords} compromised - The list of compromised passwords.
   * @param {OneTimeCodeSecrets} secrets - Draws and hashes the code.
   * @param {Clock} clock - The time of the sign-up.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    compromised: CompromisedPasswords,
    secrets: OneTimeCodeSecrets,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.hasher = hasher;
    this.compromised = compromised;
    this.secrets = secrets;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Signs the address up.
   *
   * @param {SignUpInput} input - The sign-up.
   * @returns {Promise<CodeSentView>} The address, when the code expires and when another can be
   * asked for.
   * @throws {AccountRefusal} For each refusal listed on the class.
   */
  public async execute(input: SignUpInput): Promise<CodeSentView> {
    if (!input.acceptTerms) {
      throw new AccountRefusal({ reason: 'terms-not-accepted' });
    }
    try {
      assertAcceptablePassword(input.password);
    } catch (error) {
      if (error instanceof PasswordTooShortError) {
        throw new AccountRefusal({ reason: 'password-too-short', minLength: error.minLength });
      }
      throw error;
    }
    if (await this.compromised.includes(input.password)) {
      throw new AccountRefusal({ reason: 'password-compromised' });
    }
    const email: EmailAddress = EmailAddress.of(input.email);
    const passwordHash: string = await this.hasher.hash(input.password);
    const now: Date = this.clock.now();

    return this.unitOfWork.run(async (store: AccountsStore): Promise<CodeSentView> => {
      const throttle: CodeRequestThrottle = await store.codeRequests.lock(email);
      const existing: User | null = await store.users.findByEmail(email, true);
      if (existing?.isVerified === true) {
        throw new AccountRefusal({ reason: 'email-taken' });
      }
      const accepted: AcceptedCodeRequest | Refusal = acceptCodeRequest(throttle, now);
      if ('reason' in accepted) {
        throw new AccountRefusal(accepted);
      }
      const user: User = await this.register(store, email, input.name, existing, now);
      await store.credentials.save(user.id, passwordHash);
      await store.codeRequests.save(email, accepted.throttle);
      await store.events.userSignedUp(user);
      const expiresAt: Date = await issueOneTimeCode(
        store,
        this.secrets,
        user,
        'email-verification',
        now,
      );
      return { email: email.value, expiresAt, resendAvailableAt: accepted.resendAvailableAt };
    });
  }

  /**
   * Method register
   *
   * @description
   * Creates the account of a first sign-up, or signs up again the unverified account of the
   * address, which keeps its id and takes the next version.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {EmailAddress} email - The normalized address.
   * @param {string} name - The full name as typed.
   * @param {User | null} existing - The unverified account of the address, locked, or `null`.
   * @param {Date} now - When the sign-up sets the password.
   * @returns {Promise<User>} The account after the sign-up.
   */
  private async register(
    store: AccountsStore,
    email: EmailAddress,
    name: string,
    existing: User | null,
    now: Date,
  ): Promise<User> {
    if (existing === null) {
      return store.users.insert(User.register(email, name, now));
    }
    const replaced: User = existing.replaceRegistration(name, now);
    await store.users.update(replaced);
    return replaced;
  }
  // #endregion
}
