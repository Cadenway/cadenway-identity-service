import { AccountLockedError, InvalidUserStateError } from './errors.js';

/**
 * Interface PasswordLockoutState
 *
 * @description
 * The failed password sign-ins of one address, whether or not an account uses it.
 */
export interface PasswordLockoutState {
  // #region Properties
  /**
   * Property failedAttempts
   *
   * @description
   * Consecutive failed password sign-ins since the last success or the end of the last lockout.
   *
   * @type {number}
   * @readonly
   */
  readonly failedAttempts: number;

  /**
   * Property lockedUntil
   *
   * @description
   * When the current or last lockout ends; `null` when the address was never locked since the last
   * success.
   *
   * @type {Date | null}
   * @readonly
   */
  readonly lockedUntil: Date | null;
  // #endregion
}

/**
 * Type PasswordFailure
 *
 * @description
 * Outcome of a failed password sign-in: the lockout to store, and either the attempts left before
 * the lockout (`remainingAttempts`, at least 1) or the end of the lockout it started.
 *
 * @type {{ readonly lockout: PasswordLockout; readonly remainingAttempts: number; readonly lockedUntil: null } | { readonly lockout: PasswordLockout; readonly remainingAttempts: 0; readonly lockedUntil: Date }}
 */
export type PasswordFailure =
  | {
      readonly lockout: PasswordLockout;
      readonly remainingAttempts: number;
      readonly lockedUntil: null;
    }
  | {
      readonly lockout: PasswordLockout;
      readonly remainingAttempts: 0;
      readonly lockedUntil: Date;
    };

/**
 * Class PasswordLockout
 *
 * @description
 * The lockout of the password sign-in of an address. Source: decision 2 of the walking skeleton
 * (`docs/integration.md`, "Decisions of the walking skeleton"),
 * written into `openapi/public/auth.yaml`, and the Main screen of the mockup ("Il vous reste 3
 * tentatives" after two failures, then 15 minutes):
 *
 * - failures are counted per address, whether or not an account uses it, so the answer never tells
 *   whether an account exists;
 * - five consecutive failures lock the password sign-in for 15 minutes; the failure that uses the
 *   last attempt starts the lockout, and every attempt during it is refused, even with the right
 *   password;
 * - the attempts left count down from 4 to 1 (`details.remainingAttempts`), never 0;
 * - a success resets the count, the lockout its own attempt may have started included; so does the
 *   end of a lockout.
 *
 * An attempt is counted as a failure before its password is checked, so the hash runs outside any
 * transaction while concurrent attempts are still all counted; a right password then clears it.
 * The lockout covers the password only: a sign-in with an email code is not locked.
 */
export class PasswordLockout {
  // #region Properties
  /**
   * Property MAX_FAILED_ATTEMPTS
   *
   * @description
   * Consecutive failures that lock the password sign-in.
   *
   * @type {number}
   * @readonly
   */
  public static readonly MAX_FAILED_ATTEMPTS: number = 5;

  /**
   * Property LOCK_DURATION_MS
   *
   * @description
   * Length of a lockout, in milliseconds.
   *
   * @type {number}
   * @readonly
   */
  public static readonly LOCK_DURATION_MS: number = 15 * 60_000;

  /**
   * Property state
   *
   * @description
   * The state of the lockout; a change returns a new `PasswordLockout`.
   *
   * @type {PasswordLockoutState}
   * @readonly
   */
  private readonly state: PasswordLockoutState;

  /**
   * Property snapshot
   *
   * @description
   * The state to store.
   *
   * @type {PasswordLockoutState}
   * @readonly
   */
  public get snapshot(): PasswordLockoutState {
    return this.state;
  }

  /**
   * Property isClear
   *
   * @description
   * Whether nothing is counted: the stored row can be removed.
   *
   * @type {boolean}
   * @readonly
   */
  public get isClear(): boolean {
    return this.state.failedAttempts === 0 && this.state.lockedUntil === null;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps a state checked by `restore`.
   *
   * @param {PasswordLockoutState} state - The checked state.
   * @constructor
   */
  private constructor(state: PasswordLockoutState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method clear
   *
   * @description
   * The lockout of an address with no failure counted.
   *
   * @returns {PasswordLockout} An empty lockout.
   */
  public static clear(): PasswordLockout {
    return new PasswordLockout({ failedAttempts: 0, lockedUntil: null });
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored lockout.
   *
   * @param {PasswordLockoutState} state - The stored state.
   * @returns {PasswordLockout} The lockout.
   * @throws {InvalidUserStateError} When the count is outside 0 to 5.
   */
  public static restore(state: PasswordLockoutState): PasswordLockout {
    if (
      !Number.isInteger(state.failedAttempts) ||
      state.failedAttempts < 0 ||
      state.failedAttempts > PasswordLockout.MAX_FAILED_ATTEMPTS
    ) {
      throw new InvalidUserStateError('the failed password attempts count from 0 to 5');
    }
    return new PasswordLockout(state);
  }

  /**
   * Method assertUnlocked
   *
   * @description
   * Refuses a password sign-in during a lockout, before the password is checked.
   *
   * @param {Date} now - The instant of the sign-in.
   * @throws {AccountLockedError} While the lockout lasts.
   */
  public assertUnlocked(now: Date): void {
    const lockedUntil: Date | null = this.state.lockedUntil;
    if (lockedUntil !== null && now.getTime() < lockedUntil.getTime()) {
      throw new AccountLockedError(lockedUntil);
    }
  }

  /**
   * Method recordFailure
   *
   * @description
   * Counts a password sign-in as failed, before its password is checked. A lockout that has ended
   * counts from zero again.
   *
   * @param {Date} now - The instant of the attempt.
   * @returns {PasswordFailure} The lockout to store and what to answer.
   * @throws {AccountLockedError} When called during a lockout, which `assertUnlocked` refuses first.
   */
  public recordFailure(now: Date): PasswordFailure {
    this.assertUnlocked(now);
    const counted: number = this.state.lockedUntil === null ? this.state.failedAttempts : 0;
    const failedAttempts: number = counted + 1;
    if (failedAttempts >= PasswordLockout.MAX_FAILED_ATTEMPTS) {
      const lockedUntil: Date = new Date(now.getTime() + PasswordLockout.LOCK_DURATION_MS);
      return {
        lockout: new PasswordLockout({
          failedAttempts: PasswordLockout.MAX_FAILED_ATTEMPTS,
          lockedUntil,
        }),
        remainingAttempts: 0,
        lockedUntil,
      };
    }
    return {
      lockout: new PasswordLockout({ failedAttempts, lockedUntil: null }),
      remainingAttempts: PasswordLockout.MAX_FAILED_ATTEMPTS - failedAttempts,
      lockedUntil: null,
    };
  }

  /**
   * Method recordSuccess
   *
   * @description
   * The attempt counted by `recordFailure` had the right password: the count is reset, including
   * the lockout that attempt started when it used the last one, but not a lockout already running
   * when it was counted, which `recordFailure` refused.
   *
   * @returns {PasswordLockout} An empty lockout.
   */
  public recordSuccess(): PasswordLockout {
    return PasswordLockout.clear();
  }
  // #endregion
}
