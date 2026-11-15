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
 * Type SignInWithCodeInput
 *
 * @description
 * The input of `SignInWithCode`: the sign-in code and the browser to sign in.
 *
 * @type {CodeVerificationInput}
 */
export type SignInWithCodeInput = CodeVerificationInput;

/**
 * Class SignInWithCode
 *
 * @description
 * Checks the `sign-in` code of a verified account and opens a session
 * (`POST /internal/v1/auth/sign-in/code/verification`). An address without a verified account
 * answers like a wrong code (`auth.code-invalid`); a code that no longer works answers
 * `auth.code-expired`. A wrong code stays counted: the refusal is thrown after the commit. The
 * password lockout does not apply to a code.
 */
export class SignInWithCode {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the sign-in.
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
   * The time of the sign-in.
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
   * Takes the ports of the sign-in.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the sign-in.
   * @param {OneTimeCodeSecrets} secrets - Hashes the candidate.
   * @param {SessionOpener} sessions - Opens the session.
   * @param {Clock} clock - The time of the sign-in.
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
   * Signs the account of the address in with its code.
   *
   * @param {SignInWithCodeInput} input - The code and the browser.
   * @returns {Promise<SessionIssuedView>} The session, its token and the account.
   * @throws {AccountRefusal} `auth.code-invalid` or `auth.code-expired`.
   */
  public async execute(input: SignInWithCodeInput): Promise<SessionIssuedView> {
    const email: EmailAddress = EmailAddress.of(input.email);
    const now: Date = this.clock.now();
    const outcome: SessionIssuedView | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<SessionIssuedView | Refusal> => {
        const user: User | null = await store.users.findByEmail(email, false);
        if (!user?.isVerified) {
          return { reason: 'code-invalid' };
        }
        const refusal: Refusal | null = await checkOneTimeCode(
          store,
          this.secrets,
          user,
          'sign-in',
          input.code,
          now,
        );
        if (refusal !== null) {
          return refusal;
        }
        const session: OpenedSession = await this.sessions.open({
          userId: user.id,
          persistent: input.rememberMe,
          client: input.client,
        });
        return { session, user: toAccountView(user) };
      },
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }
  // #endregion
}
