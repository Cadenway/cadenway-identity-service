import type { EmailAddress } from './email-address.js';
import {
  EmailAlreadyVerifiedError,
  InvalidUserNameError,
  InvalidUserStateError,
} from './errors.js';

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
  // #endregion
}

/**
 * Type UserRegistration
 *
 * @description
 * An account not stored yet: PostgreSQL assigns its id on insert.
 *
 * @type {Omit<UserState, 'id' | 'emailVerifiedAt'>}
 */
export type UserRegistration = Omit<UserState, 'id' | 'emailVerifiedAt'>;

/**
 * Class User
 *
 * @description
 * An account: who the person is, by name and address, and whether the address is proven. Rules,
 * from `openapi/public/auth.yaml` and `asyncapi/identity-service.yaml`:
 *
 * - a sign-up creates an account whose address is not verified (version 1);
 * - signing up again an address whose account is not verified keeps the account and its id and
 *   replaces its name (and, in the credentials, its password), with the next version;
 * - a code proves the address once; a verified account cannot be signed up again nor verified
 *   again;
 * - the name is trimmed, 1 to 120 characters; the language is `fr` by default, as the contract
 *   says (`Language`), since no route sets it yet.
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
   * The account a first sign-up creates, not verified, at version 1.
   *
   * @param {EmailAddress} email - The address signed up.
   * @param {string} name - The full name as typed.
   * @returns {UserRegistration} The account to store.
   * @throws {InvalidUserNameError} When the trimmed name is empty or too long.
   */
  public static register(email: EmailAddress, name: string): UserRegistration {
    return { email, name: User.normalizeName(name), language: User.DEFAULT_LANGUAGE, version: 1 };
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored account.
   *
   * @param {UserState} state - The stored state.
   * @returns {User} The account.
   * @throws {InvalidUserStateError} When the version is not a positive integer or the language is
   * empty.
   */
  public static restore(state: UserState): User {
    if (!Number.isInteger(state.version) || state.version < 1) {
      throw new InvalidUserStateError('the version is a positive integer');
    }
    if (state.language.length === 0) {
      throw new InvalidUserStateError('the language is set');
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
   * Method replaceRegistration
   *
   * @description
   * A new sign-up of the address of this unverified account: the account keeps its id and takes the
   * new name, with the next version (`user.signed-up.v1`, "emitted again with the next version").
   *
   * @param {string} name - The full name of the new sign-up.
   * @returns {User} The account after the sign-up.
   * @throws {EmailAlreadyVerifiedError} When the address is verified: the sign-up is refused.
   * @throws {InvalidUserNameError} When the trimmed name is empty or too long.
   */
  public replaceRegistration(name: string): User {
    if (this.isVerified) {
      throw new EmailAlreadyVerifiedError();
    }
    return new User({
      ...this.state,
      name: User.normalizeName(name),
      version: this.state.version + 1,
    });
  }

  /**
   * Method verifyEmail
   *
   * @description
   * Records that a code proved the address (`user.email-verified.v1`), with the next version.
   *
   * @param {Date} now - When the code was accepted.
   * @returns {User} The verified account.
   * @throws {EmailAlreadyVerifiedError} When the address is already verified.
   */
  public verifyEmail(now: Date): User {
    if (this.isVerified) {
      throw new EmailAlreadyVerifiedError();
    }
    return new User({ ...this.state, emailVerifiedAt: now, version: this.state.version + 1 });
  }
  // #endregion
}
