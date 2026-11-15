import { Session } from '../../domain/session.js';
import type { Clock } from '../ports/clock.port.js';
import type { DeviceDescription, DeviceReader } from '../ports/device-reader.port.js';
import type { IssuedToken, SessionTokens } from '../ports/session-tokens.port.js';
import type { SessionsStore, SessionsUnitOfWork } from '../ports/sessions-unit-of-work.port.js';

/**
 * Interface OpenSessionInput
 *
 * @description
 * The session a successful sign-in opens.
 */
export interface OpenSessionInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Verified account the session signs in.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property persistent
   *
   * @description
   * Whether the cookie outlives the browser (`rememberMe`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;

  /**
   * Property client
   *
   * @description
   * The browser, as the gateway saw it.
   *
   * @type {{ readonly ipAddress: string; readonly userAgent: string | null }}
   * @readonly
   */
  readonly client: { readonly ipAddress: string; readonly userAgent: string | null };
  // #endregion
}

/**
 * Interface OpenSessionOutput
 *
 * @description
 * The opened session and its token, which exists here only.
 */
export interface OpenSessionOutput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The opaque token (256 random bits). A secret: never logged, stored only as its SHA-256 hash.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property id
   *
   * @description
   * Id of the session.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the session ends at the latest.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property persistent
   *
   * @description
   * Whether the cookie outlives the browser.
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;
  // #endregion
}

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
