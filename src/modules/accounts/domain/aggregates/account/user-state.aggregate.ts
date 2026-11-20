import type { EmailAddress } from '../../value-objects/email/email-address.value-object.js';

/**
 * Interface UserState
 *
 * @description
 * Everything an account holds, as the repository loads it.
 */
export interface UserState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id assigned by PostgreSQL (`uuidv7()`) when the account was stored.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property email
   *
   * @description
   * The address of the account, verified or not.
   *
   * @type {EmailAddress}
   * @readonly
   */
  readonly email: EmailAddress;

  /**
   * Property name
   *
   * @description
   * Full name, trimmed.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property language
   *
   * @description
   * BCP 47 tag of the language of the account's emails.
   *
   * @type {string}
   * @readonly
   */
  readonly language: string;

  /**
   * Property displayName
   *
   * @description
   * "Nom affiché", used for the mentions; `null` until the person chooses one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly displayName: string | null;

  /**
   * Property jobTitle
   *
   * @description
   * "Poste (facultatif)"; `null` when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly jobTitle: string | null;

  /**
   * Property timeZone
   *
   * @description
   * IANA time zone name, `Europe/Paris` until the person chooses another.
   *
   * @type {string}
   * @readonly
   */
  readonly timeZone: string;

  /** Current opaque avatar reference, absent on accounts restored from the older shape. */
  readonly avatarId?: string | null;

  /** Avatar generation and invalidation fence, zero before any avatar operation. */
  readonly avatarGeneration?: number;

  /**
   * Property emailVerifiedAt
   *
   * @description
   * When a code proved the address; `null` while the sign-up is not verified.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly emailVerifiedAt: Date | null;

  /**
   * Property version
   *
   * @description
   * Version of the account, 1 when created and incremented by each change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property signUpCount
   *
   * @description
   * Accepted sign-ups of the address for this account: 1 when created, incremented by each sign-up
   * that replaced its name and password before the verification. Above 1, the verification needs
   * the password of the latest sign-up.
   *
   * @type {number}
   * @readonly
   */
  readonly signUpCount: number;

  /**
   * Property passwordChangedAt
   *
   * @description
   * When the password was last set: by the sign-up, a change or a reset (`passwordChangedAt` of
   * `User` in `openapi/internal/identity-service.yaml`).
   *
   * @type {Date}
   * @readonly
   */
  readonly passwordChangedAt: Date;

  /**
   * Property deleteAt
   *
   * @description
   * When the scheduled deletion of the account takes effect (`POST /v1/me/deletion`), `null` while
   * none is scheduled.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly deleteAt: Date | null;
  // #endregion
}
