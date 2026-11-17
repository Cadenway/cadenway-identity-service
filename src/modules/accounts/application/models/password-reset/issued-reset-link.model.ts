import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { ClientDescription } from '../sessions/client-description.model.js';

/**
 * Interface IssuedResetLink
 *
 * @description
 * What the e-mail "Réinitialisez votre mot de passe Cadenway" needs: the token travels in the
 * restricted `password-reset-link.issued.v1` only.
 */
export interface IssuedResetLink {
  // #region Properties
  /**
   * Property linkId
   *
   * @description
   * Id of the stored link.
   *
   * @type {string}
   * @readonly
   */
  readonly linkId: string;

  /**
   * Property user
   *
   * @description
   * Account the link resets: its address, name, language and time zone address the e-mail.
   *
   * @type {User}
   * @readonly
   */
  readonly user: User;

  /**
   * Property token
   *
   * @description
   * The secret of the link. Never logged, never stored in clear by this service.
   *
   * @type {string}
   * @readonly
   */
  readonly token: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the link stops working.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property client
   *
   * @description
   * The browser that asked for the link.
   *
   * @type {ClientDescription}
   * @readonly
   */
  readonly client: ClientDescription;
  // #endregion
}
