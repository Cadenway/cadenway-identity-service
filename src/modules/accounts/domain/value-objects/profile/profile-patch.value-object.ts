/**
 * Interface ProfilePatch
 *
 * @description
 * A JSON Merge Patch of the profile ("Informations personnelles" and "Langue" of the mockup's
 * "Profil", `ProfilePatch` of `openapi/public/auth.yaml`): a member left out is unchanged, `null`
 * clears `displayName` or `jobTitle`. The time zone is an IANA name and the language one of the
 * four of the contract, both checked by the HTTP schema before the domain.
 */
export interface ProfilePatch {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Full name ("Nom complet") as typed, or `undefined` to keep it.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly name?: string;

  /**
   * Property displayName
   *
   * @description
   * "Nom affiché" as typed, `null` to clear it, or `undefined` to keep it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly displayName?: string | null;

  /**
   * Property jobTitle
   *
   * @description
   * "Poste (facultatif)" as typed, `null` to clear it, or `undefined` to keep it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly jobTitle?: string | null;

  /**
   * Property timeZone
   *
   * @description
   * IANA time zone name ("Fuseau horaire"), or `undefined` to keep it.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly timeZone?: string;

  /**
   * Property language
   *
   * @description
   * BCP 47 tag of the language of the account and of its emails ("Langue"), or `undefined`.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly language?: string;
  // #endregion
}
