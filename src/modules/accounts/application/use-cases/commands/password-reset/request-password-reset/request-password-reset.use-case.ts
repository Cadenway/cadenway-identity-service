import { PasswordResetLink } from '../../../../../domain/aggregates/password-reset/password-reset-link.aggregate.js';
import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { ResetThrottledError } from '../../../../../domain/errors/password-reset/reset-throttled.error.js';
import type { AcceptedPasswordResetRequest } from '../../../../../domain/policies/password-reset/accepted-password-reset-request.policy.js';
import type { PasswordResetThrottle } from '../../../../../domain/policies/password-reset/password-reset-throttle.policy.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { IssuedResetToken } from '../../../../models/password-reset/issued-reset-token.model.js';
import type { ClientDescription } from '../../../../models/sessions/client-description.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { ResetLinkSecrets } from '../../../../ports/outbound/security/password-reset/reset-link-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { CodeSentView } from '../../../../projections/authentication/code-sent-view.projection.js';
import type { RequestPasswordResetInput } from './request-password-reset.input.js';

/**
 * Class RequestPasswordReset
 *
 * @description
 * Issues a password reset link when a verified account uses the address
 * (`POST /internal/v1/auth/password-reset`, decision 2 of P2c), and answers the same way otherwise:
 *
 * - the requests of the address are throttled, account or not, apart from the codes: 45 seconds
 *   between two and 5 in an hour (`auth.reset-throttled`);
 * - the token is drawn and the device read before the transaction whatever the address, and the
 *   transaction takes the same locks either way, so the work done for an address without an
 *   account differs only by the rows of the link;
 * - a new link makes the previous link of the account stop working; it works once, 30 minutes,
 *   from any browser, and travels only in the restricted `password-reset-link.issued.v1`;
 * - an account whose address is not verified gets no link: its sign-up code verifies it.
 */
export class RequestPasswordReset {
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
   * Draws and hashes the token of the link.
   *
   * @type {ResetLinkSecrets}
   * @readonly
   */
  private readonly secrets: ResetLinkSecrets;

  /**
   * Property devices
   *
   * @description
   * Reads the device of the browser for the e-mail.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

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
   * @param {ResetLinkSecrets} secrets - Draws and hashes the token.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {Clock} clock - The time of the request.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    secrets: ResetLinkSecrets,
    devices: DeviceReader,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.devices = devices;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Answers the request, issuing a link when a verified account uses the address.
   *
   * @param {RequestPasswordResetInput} input - The address and the browser.
   * @returns {Promise<CodeSentView>} The address, when a link issued now stops working and when the
   * next request is accepted, the same whether or not a link was issued.
   * @throws {AccountRefusal} `auth.reset-throttled`.
   */
  public async execute(input: RequestPasswordResetInput): Promise<CodeSentView> {
    const email: EmailAddress = EmailAddress.of(input.email);
    const issued: IssuedResetToken = this.secrets.issue();
    const client: ClientDescription = toClientDescription(this.devices, input.client);
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: AccountsStore): Promise<CodeSentView> => {
      const accepted: AcceptedPasswordResetRequest = RequestPasswordReset.accept(
        await store.resetRequests.lock(email),
        now,
      );
      await store.resetRequests.save(email, accepted.throttle);
      // Locked: a change of address that commits meanwhile voids the current link and moves the
      // account, which this lookup then no longer finds, so no link reaches the previous mailbox.
      const user: User | null = await store.users.findByEmail(email, true);
      if (user?.isVerified === true) {
        await store.resetLinks.replaceCurrent(user.id, now);
        const link: PasswordResetLink = await store.resetLinks.insert(
          PasswordResetLink.issue(user.id, issued.tokenHash, now),
        );
        await store.events.passwordResetLinkIssued({
          linkId: link.id,
          user,
          token: issued.token,
          expiresAt: link.snapshot.expiresAt,
          client,
        });
      }
      return {
        email: email.value,
        expiresAt: PasswordResetLink.expiryFor(now),
        resendAvailableAt: accepted.resendAvailableAt,
      };
    });
  }

  /**
   * Method accept
   *
   * @description
   * Accepts the request in the throttle of the address, or refuses it.
   *
   * @param {PasswordResetThrottle} throttle - The locked throttle.
   * @param {Date} now - The instant of the request.
   * @returns {AcceptedPasswordResetRequest} The throttle after the request.
   * @throws {AccountRefusal} `auth.reset-throttled` with `resendAvailableAt`.
   */
  private static accept(throttle: PasswordResetThrottle, now: Date): AcceptedPasswordResetRequest {
    try {
      return throttle.accept(now);
    } catch (error) {
      if (error instanceof ResetThrottledError) {
        throw new AccountRefusal({
          reason: 'reset-throttled',
          resendAvailableAt: error.resendAvailableAt,
        });
      }
      throw error;
    }
  }
  // #endregion
}
