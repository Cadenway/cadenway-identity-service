import { EmailAddress } from '../../domain/email-address.js';
import type { User } from '../../domain/user.js';
import type { CodeRequestInput } from '../account-inputs.js';
import type { CodeSentView } from '../account-views.js';
import { requestOneTimeCode } from '../one-time-codes.js';
import type { AccountsStore, AccountsUnitOfWork } from '../ports/accounts-unit-of-work.port.js';
import type { Clock } from '../ports/clock.port.js';
import type { OneTimeCodeSecrets } from '../ports/one-time-code-secrets.port.js';

/**
 * Type ResendSignUpCodeInput
 *
 * @description
 * The input of `ResendSignUpCode`: the address awaiting a new sign-up code.
 *
 * @type {CodeRequestInput}
 */
export type ResendSignUpCodeInput = CodeRequestInput;

/**
 * Class ResendSignUpCode
 *
 * @description
 * Issues a new `email-verification` code when an unverified account uses the address, the previous
 * one stopping to work (`POST /internal/v1/auth/sign-up/code`). It answers the same way when no such
 * account exists, and refuses `auth.code-throttled` within 30 seconds of the last request for the
 * address, account or not, or after 5 in the hour.
 */
export class ResendSignUpCode {
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
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the request.
   * @param {OneTimeCodeSecrets} secrets - Draws and hashes the code.
   * @param {Clock} clock - The time of the request.
   * @constructor
   */
  public constructor(unitOfWork: AccountsUnitOfWork, secrets: OneTimeCodeSecrets, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Requests a new sign-up code for the address.
   *
   * @param {ResendSignUpCodeInput} input - The request.
   * @returns {Promise<CodeSentView>} The same answer whether or not a code was issued.
   * @throws {AccountRefusal} `auth.code-throttled` within 30 seconds of the last request.
   */
  public async execute(input: ResendSignUpCodeInput): Promise<CodeSentView> {
    const email: EmailAddress = EmailAddress.of(input.email);
    const now: Date = this.clock.now();
    return this.unitOfWork.run((store: AccountsStore): Promise<CodeSentView> =>
      requestOneTimeCode(
        store,
        this.secrets,
        email,
        'email-verification',
        now,
        (user: User): boolean => !user.isVerified,
      ),
    );
  }
  // #endregion
}
