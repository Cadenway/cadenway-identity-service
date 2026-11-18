import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../ports/outbound/identity/sessions/session-opener.port.js';
import type { OneTimeCodeSecrets } from '../../../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { SessionIssuedView } from '../../../../projections/authentication/session-issued-view.projection.js';
import { checkOneTimeCode } from '../../../../services/authentication/one-time-codes.service.js';
import { completeSignIn } from '../../../../services/authentication/sign-in-completion.service.js';
import type { SignInWithCodeInput } from './sign-in-with-code.input.js';

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

  /**
   * Property devices
   *
   * @description
   * Reads the device of the browser for the security e-mails.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;
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
    devices: DeviceReader,
  ) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.sessions = sessions;
    this.clock = clock;
    this.devices = devices;
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
        const user: User | null = await store.users.findByEmail(email, true);
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
        return completeSignIn(
          store,
          this.sessions,
          this.devices,
          user,
          input.rememberMe,
          input.client,
        );
      },
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }
  // #endregion
}
