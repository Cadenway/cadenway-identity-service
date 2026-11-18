import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { BackupCodeSecrets } from '../../../../ports/outbound/security/two-step/backup-code-secrets.port.js';
import type { ChallengeTokens } from '../../../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { SessionIssuedView } from '../../../../projections/authentication/session-issued-view.projection.js';
import {
  finishChallenge,
  lockChallenge,
  lockoutRefusal,
  refuseWrongAnswer,
} from '../../../../services/two-step/challenge-answers.service.js';
import type { AnswerChallengeWithBackupCodeInput } from './answer-challenge-with-backup-code.input.js';

/**
 * Class AnswerChallengeWithBackupCode
 *
 * @description
 * Answers a two-step challenge with a backup code (`POST
 * /internal/v1/auth/sign-in/challenge/backup-code`, decision 7 of P2c): the same checks and the
 * same effects as an answer with the app, the code read upper-cased and without its dash, compared
 * by its keyed hash with the unused codes of the account; the right one is used up in the
 * transaction that opens the session, so it works once.
 */
export class AnswerChallengeWithBackupCode {
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
   * Property backupCodeSecrets
   *
   * @description
   * Hashes the backup code.
   *
   * @type {BackupCodeSecrets}
   * @readonly
   */
  private readonly backupCodeSecrets: BackupCodeSecrets;

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
   * @param {BackupCodeSecrets} backupCodeSecrets - Hashes the backup code.
   * @param {SessionOpener} sessions - Opens the session.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {TrustedDevices} trustedDevices - Trusts the browser with `trustDevice`.
   * @param {Clock} clock - The time of the answer.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    challengeTokens: ChallengeTokens,
    backupCodeSecrets: BackupCodeSecrets,
    sessions: SessionOpener,
    devices: DeviceReader,
    trustedDevices: TrustedDevices,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.challengeTokens = challengeTokens;
    this.backupCodeSecrets = backupCodeSecrets;
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
   * Answers the challenge with the backup code.
   *
   * @param {AnswerChallengeWithBackupCodeInput} input - The token, the code, `trustDevice` and the browser.
   * @returns {Promise<SessionIssuedView>} The session, its token, the account and the trusted device.
   * @throws {AccountRefusal} `auth.challenge-expired`, `auth.two-step-code-invalid` or `auth.two-step-locked`.
   */
  public async execute(input: AnswerChallengeWithBackupCodeInput): Promise<SessionIssuedView> {
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
        const codeHash: string | null = this.backupCodeSecrets.hashOf(user.id, input.code);
        if (codeHash === null || !(await store.backupCodes.use(user.id, codeHash, now))) {
          return refuseWrongAnswer(store, verification, now, 'two-step-code-invalid');
        }
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
