import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { AuthenticatorAppSecrets } from '../../../../ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import type { ChallengeTokens } from '../../../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { Totp } from '../../../../ports/outbound/security/two-step/totp.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { SessionIssuedView } from '../../../../projections/authentication/session-issued-view.projection.js';
import {
  finishChallenge,
  lockChallenge,
  lockoutRefusal,
  refuseWrongAnswer,
} from '../../../../services/two-step/challenge-answers.service.js';
import type { AnswerChallengeWithAuthenticatorAppInput } from './answer-challenge-with-authenticator-app.input.js';

/**
 * Class AnswerChallengeWithAuthenticatorApp
 *
 * @description
 * Answers a two-step challenge with a code of the app (`POST
 * /internal/v1/auth/sign-in/challenge/authenticator-app`, decision 7 of P2c), in one transaction:
 *
 * 1. the challenge: malformed, unknown, answered, replaced or expired answers
 * `auth.challenge-expired`, counting nothing;
 * 2. the lockout of the two-step answers of the account (`auth.two-step-locked`);
 * 3. the code, against the secret of the app, one step of tolerance either way, a step at or before
 * the last accepted one refused: a wrong or used code is counted with the other wrong answers and
 * answers `auth.two-step-code-invalid` with `remainingAttempts`, the fifth `auth.two-step-locked`;
 * the count commits before the refusal;
 * 4. the right code opens the session (`finishChallenge`).
 */
export class AnswerChallengeWithAuthenticatorApp {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the answer.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property challengeTokens
   *
   * @description
   * Hashes the token of the challenge.
   *
   * @type {ChallengeTokens}
   * @readonly
   */
  private readonly challengeTokens: ChallengeTokens;

  /**
   * Property appSecrets
   *
   * @description
   * Opens the sealed secret of the app.
   *
   * @type {AuthenticatorAppSecrets}
   * @readonly
   */
  private readonly appSecrets: AuthenticatorAppSecrets;

  /**
   * Property totp
   *
   * @description
   * Checks the code.
   *
   * @type {Totp}
   * @readonly
   */
  private readonly totp: Totp;

  /**
   * Property sessions
   *
   * @description
   * Opens the session.
   *
   * @type {SessionOpener}
   * @readonly
   */
  private readonly sessions: SessionOpener;

  /**
   * Property devices
   *
   * @description
   * Reads the device of the browser.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

  /**
   * Property trustedDevices
   *
   * @description
   * Trusts the browser with `trustDevice`.
   *
   * @type {TrustedDevices}
   * @readonly
   */
  private readonly trustedDevices: TrustedDevices;

  /**
   * Property clock
   *
   * @description
   * The time of the answer.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes its ports, bound by the composition of the module.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the answer.
   * @param {ChallengeTokens} challengeTokens - Hashes the token of the challenge.
   * @param {AuthenticatorAppSecrets} appSecrets - Opens the sealed secret of the app.
   * @param {Totp} totp - Checks the code.
   * @param {SessionOpener} sessions - Opens the session.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {TrustedDevices} trustedDevices - Trusts the browser with `trustDevice`.
   * @param {Clock} clock - The time of the answer.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    challengeTokens: ChallengeTokens,
    appSecrets: AuthenticatorAppSecrets,
    totp: Totp,
    sessions: SessionOpener,
    devices: DeviceReader,
    trustedDevices: TrustedDevices,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.challengeTokens = challengeTokens;
    this.appSecrets = appSecrets;
    this.totp = totp;
    this.sessions = sessions;
    this.devices = devices;
    this.trustedDevices = trustedDevices;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Answers the challenge with the code.
   *
   * @param {AnswerChallengeWithAuthenticatorAppInput} input - The token, the code, `trustDevice` and the browser.
   * @returns {Promise<SessionIssuedView>} The session, its token, the account and the trusted device.
   * @throws {AccountRefusal} `auth.challenge-expired`, `auth.two-step-code-invalid` or `auth.two-step-locked`.
   */
  public async execute(
    input: AnswerChallengeWithAuthenticatorAppInput,
  ): Promise<SessionIssuedView> {
    const now: Date = this.clock.now();
    const outcome: SessionIssuedView | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<SessionIssuedView | Refusal> => {
        const located = await lockChallenge(store, this.challengeTokens, input.token, now);
        if ('reason' in located) {
          return located;
        }
        const { user, challenge, verification } = located;
        const locked: Refusal | null = lockoutRefusal(verification, now);
        if (locked !== null) {
          return locked;
        }
        const timeStep: number | null = await this.totp.verify(
          this.appSecrets.open(user.id, verification.sealedSecret),
          input.code,
          now,
          verification.lastAcceptedTimeStep,
        );
        if (timeStep === null) {
          return refuseWrongAnswer(store, verification, now, 'two-step-code-invalid');
        }
        return finishChallenge(
          store,
          { sessions: this.sessions, devices: this.devices, trustedDevices: this.trustedDevices },
          user,
          challenge,
          verification.recordRightAnswer(timeStep),
          input,
        );
      },
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }
  // #endregion
}
