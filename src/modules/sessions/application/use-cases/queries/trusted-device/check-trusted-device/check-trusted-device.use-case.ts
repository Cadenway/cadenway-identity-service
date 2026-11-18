import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { SessionTokens } from '../../../../ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { CheckTrustedDeviceInput } from './check-trusted-device.input.js';
import type { CheckTrustedDeviceOutput } from './check-trusted-device.output.js';

/**
 * Class CheckTrustedDevice
 *
 * @description
 * Tells whether the device cookie of a sign-in names a device the account trusts, so the sign-in
 * skips its challenge. A token that is malformed is refused without a query; one unknown, expired,
 * forgotten or of another account is not trusted. Tells nothing about the token, and joins the
 * system transaction of the sign-in.
 */
export class CheckTrustedDevice {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction, joined to the one of the caller.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property tokens
   *
   * @description
   * Hashes the token, refusing a malformed one.
   *
   * @type {SessionTokens}
   * @readonly
   */
  private readonly tokens: SessionTokens;

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
   * Takes its ports, bound by the composition of the module.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction, joined to the one of the caller.
   * @param {SessionTokens} tokens - Hashes the token, refusing a malformed one.
   * @param {Clock} clock - The time of the sign-in.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, tokens: SessionTokens, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.tokens = tokens;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Checks the device cookie against the trusted devices of the account.
   *
   * @param {CheckTrustedDeviceInput} input - The account and the token.
   * @returns {Promise<CheckTrustedDeviceOutput>} Whether the device is trusted.
   */
  public async execute(input: CheckTrustedDeviceInput): Promise<CheckTrustedDeviceOutput> {
    const tokenHash: string | null = this.tokens.hashOf(input.token);
    if (tokenHash === null) {
      return { trusted: false };
    }
    const now: Date = this.clock.now();
    return {
      trusted: await this.unitOfWork.run((store: SessionsStore): Promise<boolean> =>
        store.trustedDevices.isTrusted(input.userId, tokenHash, now),
      ),
    };
  }
  // #endregion
}
