import { InvalidOneTimeCodeStateError } from './errors.js';

/**
 * Type OneTimeCodePurpose
 *
 * @description
 * What a code proves (`purpose` of `one-time-code.issued.v1`): the address of a sign-up, a sign-in
 * without a password, or a new address. `email-change` is declared by the contract and has no
 * route yet.
 *
 * @type {'email-verification' | 'sign-in' | 'email-change'}
 */
export type OneTimeCodePurpose = 'email-verification' | 'sign-in' | 'email-change';

/**
 * Constant ONE_TIME_CODE_PURPOSES
 *
 * @description
 * Every purpose, in the order of the contract; the `CHECK` constraint of the table lists the same.
 *
 * @type {readonly OneTimeCodePurpose[]}
 */
export const ONE_TIME_CODE_PURPOSES: readonly OneTimeCodePurpose[] = [
  'email-verification',
  'sign-in',
  'email-change',
];

/**
 * Interface OneTimeCodeState
 *
 * @description
 * A stored code. The code itself is never stored: only its keyed hash.
 */
export interface OneTimeCodeState {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id assigned by PostgreSQL, the `codeId` of the event.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property userId
   *
   * @description
   * Account the code is for.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property purpose
   *
   * @description
   * What the code proves.
   *
   * @type {OneTimeCodePurpose}
   * @readonly
   */
  readonly purpose: OneTimeCodePurpose;

  /**
   * Property codeHash
   *
   * @description
   * Keyed hash of the code, as hexadecimal; comparing two hashes compares two codes.
   *
   * @type {string}
   * @readonly
   */
  readonly codeHash: string;

  /**
   * Property expiresAt
   *
   * @description
   * When the code stops working.
   *
   * @type {Date}
   * @readonly
   */
  readonly expiresAt: Date;

  /**
   * Property failedAttempts
   *
   * @description
   * Wrong codes checked against this one, from 0 to `MAX_FAILED_ATTEMPTS`.
   *
   * @type {number}
   * @readonly
   */
  readonly failedAttempts: number;

  /**
   * Property consumedAt
   *
   * @description
   * When the code was accepted; a code works once.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly consumedAt: Date | null;

  /**
   * Property replacedAt
   *
   * @description
   * When a newer code of the same account and purpose replaced it.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly replacedAt: Date | null;
  // #endregion
}

/**
 * Type OneTimeCodeIssue
 *
 * @description
 * A code to store: PostgreSQL assigns its id on insert.
 *
 * @type {Pick<OneTimeCodeState, 'userId' | 'purpose' | 'codeHash' | 'expiresAt'>}
 */
export type OneTimeCodeIssue = Pick<
  OneTimeCodeState,
  'userId' | 'purpose' | 'codeHash' | 'expiresAt'
>;

/**
 * Type OneTimeCodeCheck
 *
 * @description
 * Outcome of checking a candidate against the working code of an account:
 *
 * - `accepted`: the candidate is the code; `code` is the consumed code to store;
 * - `refused`: the candidate is wrong; `code` carries the counted attempt, to store;
 * - `expired`: the code no longer works (expired, used, replaced or too many wrong attempts),
 *   whatever the candidate; nothing changes.
 *
 * @type {{ readonly outcome: 'accepted' | 'refused'; readonly code: OneTimeCode } | { readonly outcome: 'expired' }}
 */
export type OneTimeCodeCheck =
  | { readonly outcome: 'accepted' | 'refused'; readonly code: OneTimeCode }
  | { readonly outcome: 'expired' };

/**
 * Class OneTimeCode
 *
 * @description
 * A single-use 6-digit code sent by email. Rules, from `asyncapi/identity-service.yaml`
 * (`one-time-code.issued.v1`), `openapi/public/auth.yaml` and the `cw-identity-security` skill:
 *
 * - a code expires 10 minutes after it is issued for `email-verification` and `sign-in` (decision 1
 *   of the walking skeleton: the 6-digit code of the screens, not a link), 15 minutes for
 *   `email-change`;
 * - it works once;
 * - issuing a new code for the same account and purpose makes the previous one stop working, so only
 *   the latest email holds a valid code;
 * - "after a few wrong attempts it stops working": the fifth wrong code makes it stop working
 *   (decision of this service, `docs/integration.md`: five, the same count as the password lockout).
 */
export class OneTimeCode {
  // #region Properties
  /**
   * Property MAX_FAILED_ATTEMPTS
   *
   * @description
   * Wrong codes after which a code stops working.
   *
   * @type {number}
   * @readonly
   */
  public static readonly MAX_FAILED_ATTEMPTS: number = 5;

  /**
   * Property LIFETIME_MS
   *
   * @description
   * How long a code works after it is issued, per purpose, in milliseconds.
   *
   * @type {Readonly<Record<OneTimeCodePurpose, number>>}
   * @readonly
   */
  public static readonly LIFETIME_MS: Readonly<Record<OneTimeCodePurpose, number>> = {
    'email-verification': 10 * 60_000,
    'sign-in': 10 * 60_000,
    'email-change': 15 * 60_000,
  };

  /**
   * Property state
   *
   * @description
   * The state of the code; a change returns a new `OneTimeCode`.
   *
   * @type {OneTimeCodeState}
   * @readonly
   */
  private readonly state: OneTimeCodeState;

  /**
   * Property id
   *
   * @description
   * Id of the code.
   *
   * @type {string}
   * @readonly
   */
  public get id(): string {
    return this.state.id;
  }

  /**
   * Property snapshot
   *
   * @description
   * The state to store.
   *
   * @type {OneTimeCodeState}
   * @readonly
   */
  public get snapshot(): OneTimeCodeState {
    return this.state;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps a state checked by `restore`.
   *
   * @param {OneTimeCodeState} state - The checked state.
   * @constructor
   */
  private constructor(state: OneTimeCodeState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method expiryFor
   *
   * @description
   * When a code of a purpose issued at `now` stops working.
   *
   * @param {OneTimeCodePurpose} purpose - What the code proves.
   * @param {Date} now - When the code is issued.
   * @returns {Date} The end of its lifetime.
   */
  public static expiryFor(purpose: OneTimeCodePurpose, now: Date): Date {
    return new Date(now.getTime() + OneTimeCode.LIFETIME_MS[purpose]);
  }

  /**
   * Method issue
   *
   * @description
   * A new code for an account and a purpose, expiring after the lifetime of its purpose.
   *
   * @param {string} userId - Account the code is for.
   * @param {OneTimeCodePurpose} purpose - What the code proves.
   * @param {string} codeHash - Keyed hash of the code.
   * @param {Date} now - When the code is issued.
   * @returns {OneTimeCodeIssue} The code to store.
   */
  public static issue(
    userId: string,
    purpose: OneTimeCodePurpose,
    codeHash: string,
    now: Date,
  ): OneTimeCodeIssue {
    return {
      userId,
      purpose,
      codeHash,
      expiresAt: OneTimeCode.expiryFor(purpose, now),
    };
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored code.
   *
   * @param {OneTimeCodeState} state - The stored state.
   * @returns {OneTimeCode} The code.
   * @throws {InvalidOneTimeCodeStateError} When the attempt counter is outside 0 to 5.
   */
  public static restore(state: OneTimeCodeState): OneTimeCode {
    if (
      !Number.isInteger(state.failedAttempts) ||
      state.failedAttempts < 0 ||
      state.failedAttempts > OneTimeCode.MAX_FAILED_ATTEMPTS
    ) {
      throw new InvalidOneTimeCodeStateError('the failed attempts count from 0 to 5');
    }
    return new OneTimeCode(state);
  }

  /**
   * Method sameHash
   *
   * @description
   * Compares two hexadecimal hashes in a time that depends on their length only, so the time of a
   * comparison says nothing about how many characters matched.
   *
   * @param {string} left - A hash.
   * @param {string} right - Another hash.
   * @returns {boolean} Whether they are equal.
   */
  private static sameHash(left: string, right: string): boolean {
    if (left.length !== right.length) {
      return false;
    }
    let difference: number = 0;
    for (let index: number = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }

  /**
   * Method worksAt
   *
   * @description
   * Whether the code can still be accepted: not used, not replaced, not expired and below the
   * attempt limit.
   *
   * @param {Date} now - The instant of the check.
   * @returns {boolean} Whether a right candidate would be accepted.
   */
  public worksAt(now: Date): boolean {
    return (
      this.state.consumedAt === null &&
      this.state.replacedAt === null &&
      now.getTime() < this.state.expiresAt.getTime() &&
      this.state.failedAttempts < OneTimeCode.MAX_FAILED_ATTEMPTS
    );
  }

  /**
   * Method check
   *
   * @description
   * Checks a candidate. A code that no longer works answers `expired` whatever the candidate, so a
   * guess after the limit learns nothing; a wrong candidate counts one attempt.
   *
   * @param {string} candidateHash - Keyed hash of the candidate, computed like the stored one.
   * @param {Date} now - The instant of the check.
   * @returns {OneTimeCodeCheck} The outcome, with the code to store when it changed.
   */
  public check(candidateHash: string, now: Date): OneTimeCodeCheck {
    if (!this.worksAt(now)) {
      return { outcome: 'expired' };
    }
    if (OneTimeCode.sameHash(this.state.codeHash, candidateHash)) {
      return { outcome: 'accepted', code: new OneTimeCode({ ...this.state, consumedAt: now }) };
    }
    return {
      outcome: 'refused',
      code: new OneTimeCode({ ...this.state, failedAttempts: this.state.failedAttempts + 1 }),
    };
  }
  // #endregion
}
