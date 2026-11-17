import { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import {
  isNewDevice,
  NEW_DEVICE_COMPARED_USER_AGENTS,
  NEW_DEVICE_LOOKBACK_MS,
} from '../../../../../domain/policies/session/new-device.policy.js';
import type { ActiveMembership } from '../../../../models/session/active-membership.model.js';
import type { DeviceDescription } from '../../../../models/session/device-description.model.js';
import type { IssuedToken } from '../../../../models/session/issued-token.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { DeviceReader } from '../../../../ports/outbound/device/session/device-reader.port.js';
import type { ActiveMemberships } from '../../../../ports/outbound/memberships/session/active-memberships.port.js';
import type { SessionTokens } from '../../../../ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { OpenSessionInput } from './open-session.input.js';
import type { OpenSessionOutput } from './open-session.output.js';

/**
 * Class OpenSession
 *
 * @description
 * Opens the session of a verified sign-in, inside the transaction of the sign-in of the accounts
 * module (its runner joins it): a session exists only if the sign-in commits. The token is drawn
 * once, returned once, and only its SHA-256 is stored with the address, the `User-Agent` and the
 * device of the browser. The session starts in the last organization the account chose, through its
 * membership there, when the copy of the memberships still holds that membership active; else in
 * none. Its person counts as recently authenticated from the sign-in on.
 *
 * "Nouvelle connexion": when the sign-in asks for it, the session is compared, before it is
 * stored, with the devices of the sessions the account used in the last 90 days, and a device none
 * of them matches by type, browser and operating system appends
 * `session.opened-on-new-device.v1`. The session of the sign-up verification, the first of the
 * account, asks for nothing.
 */
export class OpenSession {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction, joined to the one of the sign-in.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property tokens
   *
   * @description
   * Draws and hashes the token.
   *
   * @type {SessionTokens}
   * @readonly
   */
  private readonly tokens: SessionTokens;

  /**
   * Property devices
   *
   * @description
   * Reads the device of the browser.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

  /**
   * Property memberships
   *
   * @description
   * The copy of the memberships.
   *
   * @type {ActiveMemberships}
   * @readonly
   */
  private readonly memberships: ActiveMemberships;

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
   * Takes the ports of the opening.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The transaction.
   * @param {SessionTokens} tokens - Draws and hashes the token.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {ActiveMemberships} memberships - The copy of the memberships.
   * @param {Clock} clock - The time of the sign-in.
   * @constructor
   */
  public constructor(
    unitOfWork: SessionsUnitOfWork,
    tokens: SessionTokens,
    devices: DeviceReader,
    memberships: ActiveMemberships,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.tokens = tokens;
    this.devices = devices;
    this.memberships = memberships;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Opens the session.
   *
   * @param {OpenSessionInput} input - The account, the cookie lifetime, the browser and whom to tell
   * of a new device.
   * @returns {Promise<OpenSessionOutput>} The token, once, and the session.
   */
  public async execute(input: OpenSessionInput): Promise<OpenSessionOutput> {
    const issued: IssuedToken = this.tokens.issue();
    const device: DeviceDescription = this.devices.read(input.client.userAgent);
    const now: Date = this.clock.now();
    const session: Session = await this.unitOfWork.run(
      async (store: SessionsStore): Promise<Session> => {
        const lastOrganizationId: string | null = await store.organizationChoices.find(
          input.userId,
        );
        const membership: ActiveMembership | null =
          lastOrganizationId === null
            ? null
            : await this.memberships.find(lastOrganizationId, input.userId);
        const newDevice: boolean =
          input.newDeviceNotice !== null &&
          (await this.isNewDevice(store, input.userId, device, now));
        const opened: Session = await store.sessions.insert(
          Session.start(input.userId, input.persistent, now, membership),
          {
            tokenHash: issued.tokenHash,
            ipAddress: input.client.ipAddress,
            userAgent: input.client.userAgent,
            device,
          },
        );
        if (newDevice && input.newDeviceNotice !== null) {
          await store.events.sessionOpenedOnNewDevice(
            opened,
            { device, ipAddress: input.client.ipAddress },
            input.newDeviceNotice,
          );
        }
        return opened;
      },
    );
    return {
      token: issued.token,
      id: session.id,
      expiresAt: session.snapshot.expiresAt,
      persistent: session.snapshot.persistent,
    };
  }

  /**
   * Method isNewDevice
   *
   * @description
   * Whether no session of the account used the device in the 90 days before the sign-in, among the
   * 100 browsers it used last.
   *
   * @param {SessionsStore} store - The repositories of the transaction.
   * @param {string} userId - The account.
   * @param {DeviceDescription} device - The device of the sign-in.
   * @param {Date} now - The instant of the sign-in.
   * @returns {Promise<boolean>} `true` for a device the account did not use lately.
   */
  private async isNewDevice(
    store: SessionsStore,
    userId: string,
    device: DeviceDescription,
    now: Date,
  ): Promise<boolean> {
    const userAgents: (string | null)[] = await store.sessions.findUserAgentsSince(
      userId,
      new Date(now.getTime() - NEW_DEVICE_LOOKBACK_MS),
      NEW_DEVICE_COMPARED_USER_AGENTS,
    );
    return isNewDevice(
      device,
      userAgents.map((userAgent: string | null): DeviceDescription => this.devices.read(userAgent)),
    );
  }
  // #endregion
}
