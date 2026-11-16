import { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import type { DeviceDescription } from '../../../../models/session/device-description.model.js';
import type { IssuedToken } from '../../../../models/session/issued-token.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { DeviceReader } from '../../../../ports/outbound/device/session/device-reader.port.js';
import type { SessionTokens } from '../../../../ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { OpenSessionInput } from './open-session.input.js';
import type { OpenSessionOutput } from './open-session.output.js';

/**
 * Class OpenSession
 *
 * @description
 * Opens a session for an account whose sign-in the accounts module has just verified: the entry
 * point that module consumes through its `SessionOpener` port. The token is drawn and hashed before
 * the transaction; the session row stores the hash, the browser's address and `User-Agent`, and the
 * device `bowser` reads from it. Inside the transaction of the sign-in, it joins it.
 */
export class OpenSession {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the session.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property tokens
   *
   * @description
   * Draws the token.
   *
   * @type {SessionTokens}
   * @readonly
   */
  private readonly tokens: SessionTokens;

  /**
   * Property devices
   *
   * @description
   * Reads the `User-Agent`.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

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
   * Takes the ports of the session.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The transaction of the session.
   * @param {SessionTokens} tokens - Draws the token.
   * @param {DeviceReader} devices - Reads the `User-Agent`.
   * @param {Clock} clock - The time of the sign-in.
   * @constructor
   */
  public constructor(
    unitOfWork: SessionsUnitOfWork,
    tokens: SessionTokens,
    devices: DeviceReader,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.tokens = tokens;
    this.devices = devices;
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
   * @param {OpenSessionInput} input - The account, the persistence and the browser.
   * @returns {Promise<OpenSessionOutput>} The session and its token.
   */
  public async execute(input: OpenSessionInput): Promise<OpenSessionOutput> {
    const issued: IssuedToken = this.tokens.issue();
    const device: DeviceDescription = this.devices.read(input.client.userAgent);
    const now: Date = this.clock.now();
    const session: Session = await this.unitOfWork.run((store: SessionsStore): Promise<Session> =>
      store.sessions.insert(Session.start(input.userId, input.persistent, now), {
        tokenHash: issued.tokenHash,
        ipAddress: input.client.ipAddress,
        userAgent: input.client.userAgent,
        device,
      }),
    );
    return {
      token: issued.token,
      id: session.id,
      expiresAt: session.snapshot.expiresAt,
      persistent: session.snapshot.persistent,
    };
  }
  // #endregion
}
