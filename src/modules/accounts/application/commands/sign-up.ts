import type {
  AcceptedCodeRequest,
  CodeRequestThrottle,
} from '../../domain/code-request-throttle.js';
import { EmailAddress } from '../../domain/email-address.js';
import { PasswordTooShortError } from '../../domain/errors.js';
import { assertAcceptablePassword } from '../../domain/password-policy.js';
import { User } from '../../domain/user.js';
import { AccountRefusal } from '../account-refusal.js';
import type { Refusal } from '../account-refusal.js';
import type { CodeSentView } from '../account-views.js';
import { acceptCodeRequest, issueOneTimeCode } from '../one-time-codes.js';
import type { AccountsStore, AccountsUnitOfWork } from '../ports/accounts-unit-of-work.port.js';
import type { Clock } from '../ports/clock.port.js';
import type { CompromisedPasswords } from '../ports/compromised-passwords.port.js';
import type { OneTimeCodeSecrets } from '../ports/one-time-code-secrets.port.js';
import type { PasswordHasher } from '../ports/password-hasher.port.js';

/**
 * Interface SignUpInput
 *
 * @description
 * A sign-up as the Inscription screen sends it (`SignUpRequest` of the contract).
 */
export interface SignUpInput {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Full name as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Address to sign up, as typed.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property password
   *
   * @description
   * The new password; never logged, hashed before anything is stored.
   *
   * @type {string}
   * @readonly
   */
  readonly password: string;

  /**
   * Property acceptTerms
   *
   * @description
   * Whether the person accepts the terms of use and the privacy policy.
   *
   * @type {boolean}
   * @readonly
   */
  readonly acceptTerms: boolean;
  // #endregion
}

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
      const user: User = await this.register(store, email, input.name, existing);
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
   * @returns {Promise<User>} The account after the sign-up.
   */
  private async register(
    store: AccountsStore,
    email: EmailAddress,
    name: string,
    existing: User | null,
  ): Promise<User> {
    if (existing === null) {
      return store.users.insert(User.register(email, name));
    }
    const replaced: User = existing.replaceRegistration(name);
    await store.users.update(replaced);
    return replaced;
  }
  // #endregion
}
