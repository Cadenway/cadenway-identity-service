/**
 * Interface VerifiedRegistration
 *
 * @description
 * The credential of an answer to registration options that verified: what the account stores of the
 * key, so that passkeys can come later without a migration.
 */
export interface VerifiedRegistration {
  // #region Properties
  /**
   * Property credentialId
   *
   * @description
   * The credential id, base64url.
   *
   * @type {string}
   * @readonly
   */
  readonly credentialId: string;

  /**
   * Property publicKey
   *
   * @description
   * The COSE public key, base64url.
   *
   * @type {string}
   * @readonly
   */
  readonly publicKey: string;

  /**
   * Property counter
   *
   * @description
   * The signature counter of the registration.
   *
   * @type {number}
   * @readonly
   */
  readonly counter: number;

  /**
   * Property transports
   *
   * @description
   * Its transports, as the browser gave them.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly transports: readonly string[];

  /**
   * Property backupEligible
   *
   * @description
   * Whether it may be backed up (a multi-device credential).
   *
   * @type {boolean}
   * @readonly
   */
  readonly backupEligible: boolean;

  /**
   * Property backedUp
   *
   * @description
   * Whether it is backed up.
   *
   * @type {boolean}
   * @readonly
   */
  readonly backedUp: boolean;

  /**
   * Property userVerified
   *
   * @description
   * Whether the authenticator verified the person at the registration.
   *
   * @type {boolean}
   * @readonly
   */
  readonly userVerified: boolean;
  // #endregion
}
