/**
 * Interface SessionClient
 *
 * @description
 * The browser a session is opened for, as the gateway saw it (`Client` of the contract).
 */
export interface SessionClient {
  // #region Properties
  /**
   * Property ipAddress
   *
   * @description
   * IPv4 or IPv6 address of the browser.
   *
   * @type {string}
   * @readonly
   */
  readonly ipAddress: string;

  /**
   * Property userAgent
   *
   * @description
   * `User-Agent` header of the browser, `null` when it sent none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly userAgent: string | null;
  // #endregion
}

/**
 * Interface SessionRequest
 *
 * @description
 * The session a successful sign-in opens.
 */
export interface SessionRequest {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account the session signs in.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property persistent
   *
   * @description
   * Whether "Rester connecté pendant 30 jours" was ticked (`rememberMe`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly persistent: boolean;

  /**
   * Property client
   *
   * @description
   * The browser of the session.
   *
   * @type {SessionClient}
   * @readonly
   */
  readonly client: SessionClient;
  // #endregion
}

/**
 * Interface OpenedSession
 *
 * @description
 * A session just opened, with its token, which exists here only.
 */
export interface OpenedSession {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The opaque session token, returned once. A secret: never logged, never stored in clear.
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
   * When the session ends at the latest, whatever its activity.
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
 * Interface SessionOpener
 *
 * @description
 * Opens a session through the sessions module, which owns them. Called inside the unit of work of
 * a sign-in: the session commits, or rolls back, with the verification that opened it.
 */
export interface SessionOpener {
  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens a session for an account.
   *
   * @param {SessionRequest} request - The account, the persistence and the browser.
   * @returns {Promise<OpenedSession>} The session and its token.
   */
  open(request: SessionRequest): Promise<OpenedSession>;
  // #endregion
}
