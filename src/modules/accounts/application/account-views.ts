import type { User } from '../domain/user.js';
import type { OpenedSession } from './ports/session-opener.port.js';

/**
 * Interface AccountView
 *
 * @description
 * An account as the use cases return it (`User` of the contract).
 */
export interface AccountView {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Full name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Normalized address.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property language
   *
   * @description
   * BCP 47 tag of the language of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly language: string;

  /**
   * Property version
   *
   * @description
   * Version of the account, its `ETag`.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface CodeSentView
 *
 * @description
 * The answer of a request that sends a code (`CodeSent` of the contract), the same whether or not a
 * code was actually issued.
 */
export interface CodeSentView {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The normalized address of the request.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property expiresAt
   *
   * @description
   * When a code sent now stops working.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property resendAvailableAt
   *
   * @description
   * When another code can be asked for.
   *
   * @type {Date}
   * @readonly
   */
  readonly resendAvailableAt: Date;
  // #endregion
}

/**
 * Interface SessionIssuedView
 *
 * @description
 * The answer of a successful sign-in (`SessionIssued` of the contract).
 */
export interface SessionIssuedView {
  // #region Properties
  /**
   * Property session
   *
   * @description
   * The session and its token, which leaves this service here only.
   *
   * @type {OpenedSession}
   * @readonly
   */
  readonly session: OpenedSession;

  /**
   * Property user
   *
   * @description
   * The signed-in account.
   *
   * @type {AccountView}
   * @readonly
   */
  readonly user: AccountView;
  // #endregion
}

/**
 * Function toAccountView
 *
 * @description
 * Maps an account to its view.
 *
 * @param {User} user - The account.
 * @returns {AccountView} Its view.
 */
export function toAccountView(user: User): AccountView {
  return {
    id: user.id,
    name: user.name,
    email: user.email.value,
    language: user.language,
    version: user.version,
  };
}
