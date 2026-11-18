import { EmailAlreadyVerifiedError } from '../../errors/accounts/email-already-verified.error.js';
import { EmailUnchangedError } from '../../errors/accounts/email-unchanged.error.js';
import { InvalidProfileError } from '../../errors/accounts/invalid-profile.error.js';
import { InvalidUserNameError } from '../../errors/accounts/invalid-user-name.error.js';
import { InvalidUserStateError } from '../../errors/accounts/invalid-user-state.error.js';
import { SignUpReplacedError } from '../../errors/accounts/sign-up-replaced.error.js';
import { DeletionAlreadyScheduledError } from '../../errors/deletion/deletion-already-scheduled.error.js';
import type { EmailAddress } from '../../value-objects/email/email-address.value-object.js';
import type { SignUpPasswordCheck } from '../../value-objects/password/sign-up-password-check.value-object.js';
import type { ProfilePatch } from '../../value-objects/profile/profile-patch.value-object.js';
import type { ProfileUpdate } from '../../value-objects/profile/profile-update.value-object.js';
import type { UserRegistration } from './user-registration.aggregate.js';
import type { UserState } from './user-state.aggregate.js';

/**
 * Class User
 *
 * @description
 * An account: who the person is, by name and address, and whether the address is proven. Rules,
 * from `openapi/public/auth.yaml` and `asyncapi/identity-service.yaml`:
 *
 * - a sign-up creates an account whose address is not verified (version 1);
 * - signing up again an address whose account is not verified keeps the account and its id and
 *   replaces its name (and, in the credentials, its password), with the next version, and counts
 *   one more sign-up;
 * - a code proves the address once; a verified account cannot be signed up again nor verified
 *   again;
 * - the verification is bound to the password of the latest sign-up
 *   (`POST /internal/v1/auth/sign-up/verification`, `@cadenway/contracts` 0.4.0): with the right
 *   code, a password that differs from it is refused, and so is a verification without a password
 *   once a later sign-up replaced the pending account (`auth.sign-up-replaced`), so that a sign-up
 *   of someone else's pending address never leaves the owner verifying a password it did not choose;
 *   an address signed up once is still verified by its code alone;
 * - the name is trimmed, 1 to 120 characters; the language is `fr` by default, as the contract
 *   says (`Language`);
 * - the profile ("Profil" of the mockup, `PATCH /v1/me` of `openapi/public/auth.yaml`) changes by
 *   a merge patch: a member left out is kept, `null` clears the display name or the job title; the
 *   display name is trimmed, 1 to 60 characters, the job title 1 to 120; the time zone is an IANA
 *   name, `Europe/Paris` until the person chooses another; a patch that changes something takes
 *   the next version (`user.profile-updated.v1`), one that changes nothing keeps it;
 * - a password set by the sign-up, a change or a reset records when (`passwordChangedAt`); a change
 *   or a reset takes the next version (`user.password-changed.v1`);
 * - a change of address moves to a new address, never the current one (`auth.email-unchanged`),
 *   verified by its code, with the next version (`user.email-changed.v1`);
 * - the deletion of the account is scheduled 30 days ahead (`POST /v1/me/deletion`), with the next
 *   version (`user.deletion-scheduled.v1`); a sign-in cancels it, with the next version
 *   (`user.deletion-cancelled.v1`), until the account is deleted.
 */
export class User {
  // #region Properties
  /**
   * Property DEFAULT_LANGUAGE
   *
   * @description
   * Language of a new account (`fr` by default, schema `Language` of the contract).
   *
   * @type {string}
   * @readonly
   */
  public static readonly DEFAULT_LANGUAGE: string = 'fr';

  /**
   * Property NAME_MAX_LENGTH
   *
   * @description
   * Longest full name, in code points (`maxLength: 120`).
   *
   * @type {number}
   * @readonly
   */
  public static readonly NAME_MAX_LENGTH: number = 120;

  /**
   * Property DISPLAY_NAME_MAX_LENGTH
   *
   * @description
   * Longest display name, in code points (`maxLength: 60`).
   *
   * @type {number}
   * @readonly
   */
  public static readonly DISPLAY_NAME_MAX_LENGTH: number = 60;

  /**
   * Property JOB_TITLE_MAX_LENGTH
   *
   * @description
   * Longest job title, in code points (`maxLength: 120`).
   *
   * @type {number}
   * @readonly
   */
  public static readonly JOB_TITLE_MAX_LENGTH: number = 120;

  /**
   * Property TIME_ZONE_MAX_LENGTH
   *
   * @description
   * Longest time zone name (`maxLength: 64`).
   *
   * @type {number}
   * @readonly
   */
  public static readonly TIME_ZONE_MAX_LENGTH: number = 64;

  /**
   * Property LANGUAGE_MAX_LENGTH
   *
   * @description
   * Longest language tag (BCP 47 recommends 35 characters at most).
   *
   * @type {number}
   * @readonly
   */
  public static readonly LANGUAGE_MAX_LENGTH: number = 35;

  /**
   * Property DEFAULT_TIME_ZONE
   *
   * @description
   * Time zone of an account that never chose one (`TimeZone` of `openapi/public/auth.yaml`).
   *
   * @type {string}
   * @readonly
   */
  public static readonly DEFAULT_TIME_ZONE: string = 'Europe/Paris';

  /**
   * Property DELETION_DELAY_MS
   *
   * @description
   * Delay between the scheduling of a deletion and the deletion: 30 days (decision 9 of P2c, "La
   * suppression de votre compte est programmée" of the mockup).
   *
   * @type {number}
   * @readonly
   */
  public static readonly DELETION_DELAY_MS: number = 30 * 24 * 60 * 60_000;

  /**
   * Property state
   *
   * @description
   * The state of the account; a change returns a new `User`.
   *
   * @type {UserState}
   * @readonly
   */
  private readonly state: UserState;

  /**
   * Property id
   *
   * @description
   * Id of the account.
   *
   * @type {string}
   * @readonly
   */
  public get id(): string {
    return this.state.id;
  }

  /**
   * Property email
   *
   * @description
   * Address of the account.
   *
   * @type {EmailAddress}
   * @readonly
   */
  public get email(): EmailAddress {
    return this.state.email;
  }

  /**
   * Property name
   *
   * @description
   * Full name of the account.
   *
   * @type {string}
   * @readonly
   */
  public get name(): string {
    return this.state.name;
  }

  /**
   * Property language
   *
   * @description
   * Language of the account's emails.
   *
   * @type {string}
   * @readonly
   */
  public get language(): string {
    return this.state.language;
  }

  /**
   * Property displayName
   *
   * @description
   * "Nom affiché", or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  public get displayName(): string | null {
    return this.state.displayName;
  }

  /**
   * Property jobTitle
   *
   * @description
   * "Poste (facultatif)", or `null`.
   *
   * @type {string | null}
   * @readonly
   */
  public get jobTitle(): string | null {
    return this.state.jobTitle;
  }

  /**
   * Property timeZone
   *
   * @description
   * IANA time zone name of the account.
   *
   * @type {string}
   * @readonly
   */
  public get timeZone(): string {
    return this.state.timeZone;
  }

  /**
   * Property emailVerifiedAt
   *
   * @description
   * When the address was verified, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  public get emailVerifiedAt(): Date | null {
    return this.state.emailVerifiedAt;
  }

  /**
   * Property version
   *
   * @description
   * Version of the account.
   *
   * @type {number}
   * @readonly
   */
  public get version(): number {
    return this.state.version;
  }

  /**
   * Property signUpCount
   *
   * @description
   * Accepted sign-ups of the address for this account.
   *
   * @type {number}
   * @readonly
   */
  public get signUpCount(): number {
    return this.state.signUpCount;
  }

  /**
   * Property isVerified
   *
   * @description
   * Whether a code proved the address: only such an account can sign in.
   *
   * @type {boolean}
   * @readonly
   */
  public get isVerified(): boolean {
    return this.state.emailVerifiedAt !== null;
  }

  /**
   * Property passwordChangedAt
   *
   * @description
   * When the password was last set.
   *
   * @type {Date}
   * @readonly
   */
  public get passwordChangedAt(): Date {
    return this.state.passwordChangedAt;
  }

  /**
   * Property deleteAt
   *
   * @description
   * When the scheduled deletion takes effect, or `null`.
   *
   * @type {Date | null}
   * @readonly
   */
  public get deleteAt(): Date | null {
    return this.state.deleteAt;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps a state checked by `restore`.
   *
   * @param {UserState} state - The checked state.
   * @constructor
   */
  private constructor(state: UserState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method register
   *
   * @description
   * The account a first sign-up creates, not verified, at version 1, signed up once, with no
   * display name nor job title, in the default time zone, its password set now.
   *
   * @param {EmailAddress} email - The address signed up.
   * @param {string} name - The full name as typed.
   * @param {Date} now - When the sign-up sets the password.
   * @returns {UserRegistration} The account to store.
   * @throws {InvalidUserNameError} When the trimmed name is empty or too long.
   */
  public static register(email: EmailAddress, name: string, now: Date): UserRegistration {
    return {
      passwordChangedAt: now,
      email,
      name: User.normalizeName(name),
      language: User.DEFAULT_LANGUAGE,
      displayName: null,
      jobTitle: null,
      timeZone: User.DEFAULT_TIME_ZONE,
      version: 1,
      signUpCount: 1,
    };
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored account.
   *
   * @param {UserState} state - The stored state.
   * @returns {User} The account.
   * @throws {InvalidUserStateError} When the version or the sign-up count is not a positive
   * integer, or the language or the time zone is empty.
   */
  public static restore(state: UserState): User {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InvalidUserStateError('the version is a positive integer');
    }
    if (!Number.isInteger(state.signUpCount) || state.signUpCount < 1) {
      throw new InvalidUserStateError('the sign-up count is a positive integer');
    }
    if (state.language.length === 0) {
      throw new InvalidUserStateError('the language is set');
    }
    if (state.timeZone.length === 0) {
      throw new InvalidUserStateError('the time zone is set');
    }
    if (state.deleteAt !== null && state.emailVerifiedAt === null) {
      throw new InvalidUserStateError('only a verified account has a scheduled deletion');
    }
    return new User(state);
  }

  /**
   * Method normalizeName
   *
   * @description
   * Removes the surrounding spaces of a full name ("surrounding spaces are removed",
   * `SignUpRequest.name` of `openapi/public/auth.yaml`) and checks its length.
   *
   * @param {string} name - The name as typed.
   * @returns {string} The trimmed name.
   * @throws {InvalidUserNameError} When the trimmed name is empty or longer than 120 characters.
   */
  private static normalizeName(name: string): string {
    const trimmed: string = name.trim();
    const length: number = Array.from(trimmed).length;
    if (length === 0 || length > User.NAME_MAX_LENGTH) {
      throw new InvalidUserNameError();
    }
    return trimmed;
  }

  /**
   * Method normalizeOptional
   *
   * @description
   * Trims a display name or a job title, `null` clearing it, and checks its length.
   *
   * @param {string | null} value - The value as typed, or `null`.
   * @param {number} maxLength - Its longest length, in code points.
   * @param {string} member - Its name, for the error.
   * @returns {string | null} The trimmed value, or `null`.
   * @throws {InvalidProfileError} When the trimmed value is empty or too long.
   */
  private static normalizeOptional(
    value: string | null,
    maxLength: number,
    member: string,
  ): string | null {
    if (value === null) {
      return null;
    }
    const trimmed: string = value.trim();
    const length: number = Array.from(trimmed).length;
    if (length === 0 || length > maxLength) {
      throw new InvalidProfileError(member);
    }
    return trimmed;
  }

  /**
   * Method normalizeRequired
   *
   * @description
   * Checks a time zone or a language, kept as given.
   *
   * @param {string} value - The value.
   * @param {number} maxLength - Its longest length.
   * @param {string} member - Its name, for the error.
   * @returns {string} The value.
   * @throws {InvalidProfileError} When the value is empty or too long.
   */
  private static normalizeRequired(value: string, maxLength: number, member: string): string {
    if (value.length === 0 || value.length > maxLength) {
      throw new InvalidProfileError(member);
    }
    return value;
  }

  /**
   * Method updateProfile
   *
   * @description
   * Applies a merge patch to the profile: each member given replaces the current one once
   * normalized, and the account takes the next version when one of them moved.
   *
   * @param {ProfilePatch} patch - The patch.
   * @returns {ProfileUpdate} The account after the patch and the members that moved; this account
   * and no member when nothing moved.
   * @throws {InvalidUserNameError} When the trimmed name is empty or too long.
   * @throws {InvalidProfileError} When another member breaks its rule.
   */
  public updateProfile(patch: ProfilePatch): ProfileUpdate {
    const next: UserState = {
      ...this.state,
      name: patch.name === undefined ? this.state.name : User.normalizeName(patch.name),
      displayName:
        patch.displayName === undefined
          ? this.state.displayName
          : User.normalizeOptional(patch.displayName, User.DISPLAY_NAME_MAX_LENGTH, 'display name'),
      jobTitle:
        patch.jobTitle === undefined
          ? this.state.jobTitle
          : User.normalizeOptional(patch.jobTitle, User.JOB_TITLE_MAX_LENGTH, 'job title'),
      timeZone:
        patch.timeZone === undefined
          ? this.state.timeZone
          : User.normalizeRequired(patch.timeZone, User.TIME_ZONE_MAX_LENGTH, 'time zone'),
      language:
        patch.language === undefined
          ? this.state.language
          : User.normalizeRequired(patch.language, User.LANGUAGE_MAX_LENGTH, 'language'),
    };
    const members: readonly ('name' | 'displayName' | 'jobTitle' | 'timeZone' | 'language')[] = [
      'name',
      'displayName',
      'jobTitle',
      'timeZone',
      'language',
    ];
    const changed: string[] = members.filter((member) => next[member] !== this.state[member]);
    if (changed.length === 0) {
      return { user: this, changed };
    }
    return { user: new User({ ...next, version: this.state.version + 1 }), changed };
  }

  /**
   * Method replaceRegistration
   *
   * @description
   * A new accepted sign-up of the address of this unverified account: the account keeps its id and
   * takes the new name, with the next version (`user.signed-up.v1`, "emitted again with the next
   * version"), and counts one more sign-up, so its verification now needs the password of this
   * sign-up.
   *
   * @param {string} name - The full name of the new sign-up.
   * @param {Date} now - When the new sign-up sets the password.
   * @returns {User} The account after the sign-up.
   * @throws {EmailAlreadyVerifiedError} When the address is verified: the sign-up is refused.
   * @throws {InvalidUserNameError} When the trimmed name is empty or too long.
   */
  public replaceRegistration(name: string, now: Date): User {
    if (this.isVerified) {
      throw new EmailAlreadyVerifiedError();
    }
    return new User({
      ...this.state,
      name: User.normalizeName(name),
      passwordChangedAt: now,
      version: this.state.version + 1,
      signUpCount: this.state.signUpCount + 1,
    });
  }

  /**
   * Method assertProvesSignUp
   *
   * @description
   * Checks that a verification with the right code proves the latest sign-up of the address
   * (`SignUpVerification` of `openapi/internal/identity-service.yaml`): a password that differs
   * from the one of that sign-up never does; no password does only while the address was signed up
   * once.
   *
   * @param {SignUpPasswordCheck} password - What the verification says of the password.
   * @throws {SignUpReplacedError} When the verification does not prove the latest sign-up.
   */
  public assertProvesSignUp(password: SignUpPasswordCheck): void {
    if (password === 'differs' || (password === 'not-sent' && this.state.signUpCount > 1)) {
      throw new SignUpReplacedError();
    }
  }

  /**
   * Method verifyEmail
   *
   * @description
   * Records that a code proved the address (`user.email-verified.v1`), with the next version, once
   * the verification proves the latest sign-up (`assertProvesSignUp`).
   *
   * @param {Date} now - When the code was accepted.
   * @param {SignUpPasswordCheck} password - What the verification says of the password.
   * @returns {User} The verified account.
   * @throws {EmailAlreadyVerifiedError} When the address is already verified.
   * @throws {SignUpReplacedError} When the verification does not prove the latest sign-up.
   */
  public verifyEmail(now: Date, password: SignUpPasswordCheck): User {
    if (this.isVerified) {
      throw new EmailAlreadyVerifiedError();
    }
    this.assertProvesSignUp(password);
    return new User({ ...this.state, emailVerifiedAt: now, version: this.state.version + 1 });
  }

  /**
   * Method changeTwoStepVerification
   *
   * @description
   * Records a change of the two-step verification of the account (turned on or off, its app
   * replaced, its backup codes regenerated, a key added or removed) with the next version, the
   * `version` of `user.two-step-verification-changed.v1` ("A change of ... the two-step
   * verification ... makes it the next one", `User.version` of the contract). The factors
   * themselves are credentials, kept apart.
   *
   * @returns {User} The account after the change.
   */
  public changeTwoStepVerification(): User {
    return new User({ ...this.state, version: this.state.version + 1 });
  }

  /**
   * Method changePassword
   *
   * @description
   * Records a new password, set by a change from a session or by a reset link, with the next
   * version (`user.password-changed.v1`). The hash itself is a credential, kept apart.
   *
   * @param {Date} now - When the new password was set.
   * @returns {User} The account after the change.
   */
  public changePassword(now: Date): User {
    return new User({ ...this.state, passwordChangedAt: now, version: this.state.version + 1 });
  }

  /**
   * Method assertNewEmail
   *
   * @description
   * Checks that a change of address names another address than the current one
   * (`POST /v1/me/email-change`).
   *
   * @param {EmailAddress} email - The new address.
   * @throws {EmailUnchangedError} When it is the current address.
   */
  public assertNewEmail(email: EmailAddress): void {
    if (email.equals(this.state.email)) {
      throw new EmailUnchangedError();
    }
  }

  /**
   * Method changeEmail
   *
   * @description
   * Makes a new address, proven by the code sent to it, the verified address of the account, with
   * the next version (`user.email-changed.v1`).
   *
   * @param {EmailAddress} email - The new address.
   * @param {Date} now - When the code proved it.
   * @returns {User} The account after the change.
   * @throws {EmailUnchangedError} When it is the current address.
   */
  public changeEmail(email: EmailAddress, now: Date): User {
    this.assertNewEmail(email);
    return new User({
      ...this.state,
      email,
      emailVerifiedAt: now,
      version: this.state.version + 1,
    });
  }

  /**
   * Method scheduleDeletion
   *
   * @description
   * Schedules the deletion of the account 30 days ahead, with the next version
   * (`user.deletion-scheduled.v1`).
   *
   * @param {Date} now - When the deletion was asked.
   * @returns {User} The account, its deletion scheduled.
   * @throws {DeletionAlreadyScheduledError} When a deletion is already scheduled.
   */
  public scheduleDeletion(now: Date): User {
    if (this.state.deleteAt !== null) {
      throw new DeletionAlreadyScheduledError();
    }
    return new User({
      ...this.state,
      deleteAt: new Date(now.getTime() + User.DELETION_DELAY_MS),
      version: this.state.version + 1,
    });
  }

  /**
   * Method cancelDeletion
   *
   * @description
   * Cancels the scheduled deletion, as a sign-in does ("une connexion suffit pour annuler"), with
   * the next version (`user.deletion-cancelled.v1`); an account without one is returned as it is.
   *
   * @returns {User} The account without a scheduled deletion.
   */
  public cancelDeletion(): User {
    if (this.state.deleteAt === null) {
      return this;
    }
    return new User({ ...this.state, deleteAt: null, version: this.state.version + 1 });
  }

  /**
   * Method isDeletionDueAt
   *
   * @description
   * Whether the scheduled deletion of the account takes effect at an instant: from `deleteAt` on.
   *
   * @param {Date} now - The instant.
   * @returns {boolean} `true` when a deletion is scheduled and due.
   */
  public isDeletionDueAt(now: Date): boolean {
    return this.state.deleteAt !== null && now.getTime() >= this.state.deleteAt.getTime();
  }
  // #endregion
}
