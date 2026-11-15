import { EmailAddress } from '../../domain/email-address.js';
import type { User } from '../../domain/user.js';
import type { CodeVerificationInput } from '../account-inputs.js';
import { AccountRefusal } from '../account-refusal.js';
import type { Refusal } from '../account-refusal.js';
import { toAccountView } from '../account-views.js';
import type { SessionIssuedView } from '../account-views.js';
import { checkOneTimeCode } from '../one-time-codes.js';
import type { AccountsStore, AccountsUnitOfWork } from '../ports/accounts-unit-of-work.port.js';
import type { Clock } from '../ports/clock.port.js';
import type { OneTimeCodeSecrets } from '../ports/one-time-code-secrets.port.js';
import type { OpenedSession, SessionOpener } from '../ports/session-opener.port.js';

/**
 * Type VerifySignUpInput
 *
 * @description
 * The input of `VerifySignUp`: the sign-up code and the browser to sign in.
 *
 * @type {CodeVerificationInput}
 */
export type VerifySignUpInput = CodeVerificationInput;

/**
 * Class VerifySignUp
 *
 * @description
 * Checks the `email-verification` code of an unverified account, verifies its address and opens a
 * session (`POST /internal/v1/auth/sign-up/verification`), in one transaction that appends
 * `user.email-verified.v1`. An address without an unverified account answers like a wrong code
 * (`auth.code-invalid`); a code that no longer works answers `auth.code-expired`. A wrong code
 * stays counted: the refusal is thrown after the commit.
 */
export class VerifySignUp {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the verification.
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
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the verification.
   * @param {OneTimeCodeSecrets} secrets - Hashes the candidate.
   * @param {SessionOpener} sessions - Opens the session.
   * @param {Clock} clock - The time of the verification.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    sessions: SessionOpener,
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
   * Verifies the address and signs the account in.
   *
   * @param {VerifySignUpInput} input - The code and the browser.
   * @returns {Promise<SessionIssuedView>} The session, its token and the verified account.
   * @throws {AccountRefusal} `auth.code-invalid` or `auth.code-expired`.
   */
  public async execute(input: VerifySignUpInput): Promise<SessionIssuedView> {
    const email: EmailAddress = EmailAddress.of(input.email);
    const now: Date = this.clock.now();
    const outcome: SessionIssuedView | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<SessionIssuedView | Refusal> => {
        const user: User | null = await store.users.findByEmail(email, true);
        if (user === null || user.isVerified) {
          return { reason: 'code-invalid' };
        }
        const refusal: Refusal | null = await checkOneTimeCode(
          store,
          this.secrets,
          user,
          'email-verification',
          input.code,
          now,
        );
        if (refusal !== null) {
          return refusal;
        }
        const verified: User = user.verifyEmail(now);
        await store.users.update(verified);
        await store.events.userEmailVerified(verified);
        const session: OpenedSession = await this.sessions.open({
          userId: verified.id,
          persistent: input.rememberMe,
          client: input.client,
        });
        return { session, user: toAccountView(verified) };
      },
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }
  // #endregion
}
