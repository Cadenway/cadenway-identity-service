import { InvalidTwoStepStateError } from '../../errors/two-step/invalid-two-step-state.error.js';
import { TwoStepLockedError } from '../../errors/two-step/two-step-locked.error.js';
import type { TwoStepFailure } from './two-step-failure.aggregate.js';
import type { TwoStepVerificationState } from './two-step-verification-state.aggregate.js';

/**
 * Class TwoStepVerification
 *
 * @description
 * The two-step verification of an account while it is on (decision 7 of P2c): its authenticator
 * app (TOTP, RFC 6238), the WebAuthn handle of its security keys, when its backup codes were drawn,
 * and the lockout of its two-step answers. It exists from the confirmation of a first app to the
 * disabling; the security keys and the backup codes are rows of their own.
 *
 * - A code of the app is accepted once: its time step must be later than the last accepted one
 *   (`afterTimeStep` of otplib), so a code seen by a third party cannot be replayed.
 * - Five wrong answers in a row, across the challenges of the account and the codes of its
 *   re-authentication, lock its two-step answers for 15 minutes (`auth.two-step-locked`);
 *   `remainingAttempts` counts down from 4 to 1; a right answer ends the count, and so does the end
 *   of the lockout.
 */
export class TwoStepVerification {
  // #region Properties
  /**
   * Property MAX_WRONG_ANSWERS
   *
   * @description
   * Wrong answers in a row that lock the two-step answers (decision 7).
   *
   * @type {number}
   * @readonly
   */
  public static readonly MAX_WRONG_ANSWERS: number = 5;

  /**
   * Property LOCK_DURATION_MS
   *
   * @description
   * Length of the lockout, 15 minutes (decision 7).
   *
   * @type {number}
   * @readonly
   */
  public static readonly LOCK_DURATION_MS: number = 15 * 60_000;

  /**
   * Property BACKUP_CODE_COUNT
   *
   * @description
   * Backup codes drawn when two-step verification turns on and at each regeneration.
   *
   * @type {number}
   * @readonly
   */
  public static readonly BACKUP_CODE_COUNT: number = 10;

  /**
   * Property state
   *
   * @description
   * The stored state.
   *
   * @type {TwoStepVerificationState}
   * @readonly
   */
  private readonly state: TwoStepVerificationState;

  /**
   * Property userId
   *
   * @description
   * The account.
   *
   * @type {string}
   */
  public get userId(): string {
    return this.state.userId;
  }

  /**
   * Property sealedSecret
   *
   * @description
   * The sealed secret of the current authenticator app.
   *
   * @type {string}
   */
  public get sealedSecret(): string {
    return this.state.sealedSecret;
  }

  /**
   * Property lastAcceptedTimeStep
   *
   * @description
   * The time step of the last accepted code, `null` before any.
   *
   * @type {number | null}
   */
  public get lastAcceptedTimeStep(): number | null {
    return this.state.lastAcceptedTimeStep;
  }

  /**
   * Property webauthnUserHandle
   *
   * @description
   * The WebAuthn handle of the account.
   *
   * @type {string}
   */
  public get webauthnUserHandle(): string {
    return this.state.webauthnUserHandle;
  }

  /**
   * Property snapshot
   *
   * @description
   * The state, for the repository.
   *
   * @type {TwoStepVerificationState}
   */
  public get snapshot(): TwoStepVerificationState {
    return this.state;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Wraps a checked state; use `enable` or `restore`.
   *
   * @param {TwoStepVerificationState} state - The state.
   * @constructor
   */
  private constructor(state: TwoStepVerificationState) {
    this.state = state;
  }
  // #endregion

  // #region Methods
  /**
   * Method enable
   *
   * @description
   * Turns two-step verification on with a first authenticator app, confirmed by a code of the time
   * step `acceptedTimeStep`, and its first backup codes, drawn now.
   *
   * @param {string} userId - The account.
   * @param {string} sealedSecret - The sealed secret of the app.
   * @param {number} acceptedTimeStep - The time step of the confirmation code.
   * @param {string} webauthnUserHandle - A new WebAuthn handle of the account.
   * @param {Date} now - The instant of the confirmation.
   * @returns {TwoStepVerification} The two-step verification of the account.
   */
  public static enable(
    userId: string,
    sealedSecret: string,
    acceptedTimeStep: number,
    webauthnUserHandle: string,
    now: Date,
  ): TwoStepVerification {
    return TwoStepVerification.restore({
      userId,
      sealedSecret,
      authenticatorConfiguredAt: now,
      lastAcceptedTimeStep: acceptedTimeStep,
      webauthnUserHandle,
      failedAnswers: 0,
      lockedUntil: null,
      backupCodesGeneratedAt: now,
      enabledAt: now,
    });
  }

  /**
   * Method restore
   *
   * @description
   * Rebuilds a stored two-step verification.
   *
   * @param {TwoStepVerificationState} state - The stored state.
   * @returns {TwoStepVerification} The two-step verification.
   * @throws {InvalidTwoStepStateError} For a count of wrong answers outside 0 to 5, a negative time
   * step, or an empty secret or handle.
   */
  public static restore(state: TwoStepVerificationState): TwoStepVerification {
    if (
      !Number.isInteger(state.failedAnswers) ||
      state.failedAnswers < 0 ||
      state.failedAnswers > TwoStepVerification.MAX_WRONG_ANSWERS
    ) {
      throw new InvalidTwoStepStateError('the wrong answers count from 0 to 5');
    }
    if (
      state.lastAcceptedTimeStep !== null &&
      (!Number.isInteger(state.lastAcceptedTimeStep) || state.lastAcceptedTimeStep < 0)
    ) {
      throw new InvalidTwoStepStateError('a time step is a non-negative integer');
    }
    if (state.sealedSecret.length === 0 || state.webauthnUserHandle.length === 0) {
      throw new InvalidTwoStepStateError('the secret and the handle are set');
    }
    return new TwoStepVerification(state);
  }

  /**
   * Method lockedUntilAt
   *
   * @description
   * The end of the lockout of the two-step answers at an instant, `null` when they are not locked
   * (`lockedUntil` of a `SignInChallenge`).
   *
   * @param {Date} now - The instant.
   * @returns {Date | null} The end of the lockout, or `null`.
   */
  public lockedUntilAt(now: Date): Date | null {
    const lockedUntil: Date | null = this.state.lockedUntil;
    return lockedUntil !== null && now.getTime() < lockedUntil.getTime() ? lockedUntil : null;
  }

  /**
   * Method assertUnlocked
   *
   * @description
   * Refuses any two-step answer during the lockout, before the answer is checked.
   *
   * @param {Date} now - The instant of the answer.
   * @throws {TwoStepLockedError} While the two-step answers are locked.
   */
  public assertUnlocked(now: Date): void {
    const lockedUntil: Date | null = this.lockedUntilAt(now);
    if (lockedUntil !== null) {
      throw new TwoStepLockedError(lockedUntil);
    }
  }

  /**
   * Method recordWrongAnswer
   *
   * @description
   * Counts a wrong answer; the fifth in a row locks the answers for 15 minutes. A count left by an
   * ended lockout starts again from zero.
   *
   * @param {Date} now - The instant of the answer.
   * @returns {TwoStepFailure} The verification to save and what the refusal says.
   * @throws {TwoStepLockedError} During the lockout: an answer then is never counted.
   */
  public recordWrongAnswer(now: Date): TwoStepFailure {
    this.assertUnlocked(now);
    const counted: number = this.state.lockedUntil === null ? this.state.failedAnswers : 0;
    const failedAnswers: number = counted + 1;
    if (failedAnswers >= TwoStepVerification.MAX_WRONG_ANSWERS) {
      const lockedUntil: Date = new Date(now.getTime() + TwoStepVerification.LOCK_DURATION_MS);
      return {
        verification: new TwoStepVerification({
          ...this.state,
          failedAnswers: TwoStepVerification.MAX_WRONG_ANSWERS,
          lockedUntil,
        }),
        remainingAttempts: 0,
        lockedUntil,
      };
    }
    return {
      verification: new TwoStepVerification({ ...this.state, failedAnswers, lockedUntil: null }),
      remainingAttempts: TwoStepVerification.MAX_WRONG_ANSWERS - failedAnswers,
      lockedUntil: null,
    };
  }

  /**
   * Method recordRightAnswer
   *
   * @description
   * Ends the count of wrong answers after a right one and, for a code of the app, records its time
   * step, so that the same code is never accepted again.
   *
   * @param {number | null} timeStep - The time step of an accepted code of the app, or `null` for
   * a backup code or a security key.
   * @returns {TwoStepVerification} The verification to save.
   * @throws {InvalidTwoStepStateError} For a time step that is not later than the last accepted.
   */
  public recordRightAnswer(timeStep: number | null): TwoStepVerification {
    if (timeStep !== null) {
      this.assertLaterTimeStep(timeStep);
    }
    return new TwoStepVerification({
      ...this.state,
      failedAnswers: 0,
      lockedUntil: null,
      lastAcceptedTimeStep: timeStep ?? this.state.lastAcceptedTimeStep,
    });
  }

  /**
   * Method replaceAuthenticatorApp
   *
   * @description
   * Makes a newly confirmed app the authenticator app of the account ("Reconfigurer"): the previous
   * one stops working, the backup codes, the keys and the handle stay.
   *
   * @param {string} sealedSecret - The sealed secret of the new app.
   * @param {number} acceptedTimeStep - The time step of its confirmation code.
   * @param {Date} now - The instant of the confirmation.
   * @returns {TwoStepVerification} The verification to save.
   */
  public replaceAuthenticatorApp(
    sealedSecret: string,
    acceptedTimeStep: number,
    now: Date,
  ): TwoStepVerification {
    return TwoStepVerification.restore({
      ...this.state,
      sealedSecret,
      authenticatorConfiguredAt: now,
      lastAcceptedTimeStep: acceptedTimeStep,
    });
  }

  /**
   * Method regenerateBackupCodes
   *
   * @description
   * Records that new backup codes were drawn now ("Générer de nouveaux codes").
   *
   * @param {Date} now - The instant of the regeneration.
   * @returns {TwoStepVerification} The verification to save.
   */
  public regenerateBackupCodes(now: Date): TwoStepVerification {
    return new TwoStepVerification({ ...this.state, backupCodesGeneratedAt: now });
  }

  /**
   * Method assertLaterTimeStep
   *
   * @description
   * Refuses a time step already accepted, or an earlier one.
   *
   * @param {number} timeStep - The time step of a code.
   * @throws {InvalidTwoStepStateError} For a replayed or earlier step.
   */
  private assertLaterTimeStep(timeStep: number): void {
    const last: number | null = this.state.lastAcceptedTimeStep;
    if (!Number.isInteger(timeStep) || (last !== null && timeStep <= last)) {
      throw new InvalidTwoStepStateError('a code of the app is accepted once');
    }
  }
  // #endregion
}
