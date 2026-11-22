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

  /**
   * Property newDeviceNotice
   *
   * @description
   * Whom the "Nouvelle connexion" e-mail addresses when the device was not used by the account in
   * the last 90 days (`session.opened-on-new-device.v1`): the address, name, language and time zone
   * of the account. `null` for the session of the sign-up verification, the first of the account,
   * which tells nobody.
   *
   * @type {{ readonly email: string; readonly name: string; readonly language: string; readonly timeZone: string } | null}
   * @readonly
   */
  readonly newDeviceNotice: {
    readonly email: string;
    readonly name: string;
    readonly language: string;
    readonly timeZone: string;
  } | null;

  /**
   * Property authentication
   *
   * @description
   * The proof the sign-in brought, which opens the window of recent authentication of the session:
   * `password` for the sign-in of an account without two-step verification, `two-step` for the
   * answer of a challenge, `null` for a sign-in on a trusted device, which opens none.
   *
   * @type {'password' | 'two-step' | null}
   * @readonly
   */
  readonly authentication: 'password' | 'two-step' | null;

  /** The originating SAML membership when the session depends on a SAML sign-in. */
  readonly samlMembership?: { readonly organizationId: string; readonly memberId: string } | null;
  // #endregion
}
