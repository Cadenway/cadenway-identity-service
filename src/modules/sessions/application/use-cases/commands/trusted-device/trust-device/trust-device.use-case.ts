import {
  MAX_TRUSTED_DEVICES,
  TRUSTED_DEVICE_LIFETIME_MS,
} from '../../../../../domain/policies/session/trusted-device.policy.js';
import type { IssuedToken } from '../../../../models/session/issued-token.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { SessionTokens } from '../../../../ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { TrustDeviceInput } from './trust-device.input.js';
import type { TrustDeviceOutput } from './trust-device.output.js';

/**
 * Class TrustDevice
 *
 * @description
 * Makes the browser of a challenge answer a trusted device of its account for 30 days ("Faire
 * confiance à cet appareil pendant 30 jours", decision 7 of P2c): a new token of 256 random bits,
 * returned once, of which only the SHA-256 is stored. The devices of the account no longer trusted
 * are deleted in the same transaction, and the oldest ones beyond the 10 an account keeps, so they
 * do not accumulate. Joins the system transaction of
 * the answer of the challenge.
 */
export class TrustDevice {
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
   * Draws the device token and its hash, like a session token.
   *
   * @type {SessionTokens}
   * @readonly
   */
  private readonly tokens: SessionTokens;

  /**
   * Property clock
   *
   * @description
   * The time of the answer.
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
   * @param {SessionTokens} tokens - Draws the device token and its hash, like a session token.
   * @param {Clock} clock - The time of the answer.
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
   * Trusts a new device of the account.
   *
   * @param {TrustDeviceInput} input - The account.
   * @returns {Promise<TrustDeviceOutput>} The device token and its expiry.
   */
  public async execute(input: TrustDeviceInput): Promise<TrustDeviceOutput> {
    const issued: IssuedToken = this.tokens.issue();
    const now: Date = this.clock.now();
    const expiresAt: Date = new Date(now.getTime() + TRUSTED_DEVICE_LIFETIME_MS);
    await this.unitOfWork.run(async (store: SessionsStore): Promise<void> => {
      await store.trustedDevices.pruneOfUser(input.userId, now, MAX_TRUSTED_DEVICES - 1);
      await store.trustedDevices.insert(input.userId, issued.tokenHash, expiresAt);
    });
    return { token: issued.token, expiresAt };
  }
  // #endregion
}
