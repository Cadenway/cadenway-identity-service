import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { SecurityKeyRecord } from '../../../../models/two-step/security-key-record.model.js';
import type { VerifiedAssertion } from '../../../../models/two-step/verified-assertion.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { ChallengeTokens } from '../../../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { WebAuthn } from '../../../../ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { SessionIssuedView } from '../../../../projections/authentication/session-issued-view.projection.js';
import {
  finishChallenge,
  lockChallenge,
  lockoutRefusal,
  refuseWrongAnswer,
} from '../../../../services/two-step/challenge-answers.service.js';
import type { AnswerChallengeWithSecurityKeyInput } from './answer-challenge-with-security-key.input.js';

/**
 * Class AnswerChallengeWithSecurityKey
 *
 * @description
 * Answers a two-step challenge with a security key (`POST
 * /internal/v1/auth/sign-in/challenge/security-key`, decision 7 of P2c): the challenge first
 * (`auth.challenge-expired`), the lockout (`auth.two-step-locked`), then the answer, verified
 * against the latest options of the challenge, still valid, and the key of the account it names
 * (`WebAuthn.verifyAssertion`: the exact origin, the relying party, the signature, the counter,
 * `userHandle`). An answer that does not verify, options expired or replaced included, is counted
 * with the other wrong answers (`auth.security-key-refused` with `remainingAttempts`). The right
 * one records the counter and the last use of the key and opens the session (`finishChallenge`).
 */
export class AnswerChallengeWithSecurityKey {
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
   * Property webAuthn
   *
   * @description
   * Verifies the answer of the key.
   *
   * @type {WebAuthn}
   * @readonly
   */
  private readonly webAuthn: WebAuthn;

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
   * @param {WebAuthn} webAuthn - Verifies the answer of the key.
   * @param {SessionOpener} sessions - Opens the session.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {TrustedDevices} trustedDevices - Trusts the browser with `trustDevice`.
   * @param {Clock} clock - The time of the answer.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    challengeTokens: ChallengeTokens,
    webAuthn: WebAuthn,
    sessions: SessionOpener,
    devices: DeviceReader,
    trustedDevices: TrustedDevices,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.challengeTokens = challengeTokens;
    this.webAuthn = webAuthn;
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
   * Answers the challenge with the key.
   *
   * @param {AnswerChallengeWithSecurityKeyInput} input - The token, the answer of the key, `trustDevice` and the browser.
   * @returns {Promise<SessionIssuedView>} The session, its token, the account and the trusted device.
   * @throws {AccountRefusal} `auth.challenge-expired`, `auth.security-key-refused` or `auth.two-step-locked`.
   */
  public async execute(input: AnswerChallengeWithSecurityKeyInput): Promise<SessionIssuedView> {
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
        const expected: string | null = challenge.assertionChallengeAt(now);
        const key: SecurityKeyRecord | undefined = (
          await store.securityKeys.listOfUser(user.id)
        ).find(
          (candidate: SecurityKeyRecord): boolean => candidate.credentialId === input.credential.id,
        );
        const verified: VerifiedAssertion | null =
          expected === null || key === undefined
            ? null
            : await this.webAuthn.verifyAssertion(
                input.credential,
                expected,
                key,
                verification.webauthnUserHandle,
              );
        if (verified === null || key === undefined) {
          return refuseWrongAnswer(store, verification, now, 'security-key-refused');
        }
        await store.securityKeys.recordUse(key.id, verified.newCounter, now);
        return finishChallenge(
          store,
          { sessions: this.sessions, devices: this.devices, trustedDevices: this.trustedDevices },
          user,
          challenge,
          verification.recordRightAnswer(null),
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
