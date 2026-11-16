import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { OneTimeCodeSecrets } from '../../../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { CodeSentView } from '../../../../projections/authentication/code-sent-view.projection.js';
import { requestOneTimeCode } from '../../../../services/authentication/one-time-codes.service.js';
import type { RequestSignInCodeInput } from './request-sign-in-code.input.js';

/**
 * Class RequestSignInCode
 *
 * @description
 * Issues a `sign-in` code when a verified account uses the address, the previous one stopping to
 * work (`POST /internal/v1/auth/sign-in/code`). It answers the same way when no such account
 * exists. The request is throttled per address, account or not, together with the sign-up codes
 * (`CodeThrottled` of the contract): `auth.code-throttled` less than 30 seconds after the last
 * accepted request, or once 5 were accepted in the hour.
 */
export class RequestSignInCode {
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
   * Requests a sign-in code for the address.
   *
   * @param {RequestSignInCodeInput} input - The request.
   * @returns {Promise<CodeSentView>} The same answer whether or not a code was issued.
   * @throws {AccountRefusal} `auth.code-throttled` less than 30 seconds after the last accepted
   * request of the address, whatever its purpose, or once 5 were accepted in the hour.
   */
  public async execute(input: RequestSignInCodeInput): Promise<CodeSentView> {
    const email: EmailAddress = EmailAddress.of(input.email);
    const now: Date = this.clock.now();
    return this.unitOfWork.run((store: AccountsStore): Promise<CodeSentView> =>
      requestOneTimeCode(
        store,
        this.secrets,
        email,
        'sign-in',
        now,
        (user: User): boolean => user.isVerified,
      ),
    );
  }
  // #endregion
}
