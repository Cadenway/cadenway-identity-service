import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { TwoStepVerification } from '../../../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { BackupCodeSecrets } from '../../../../ports/outbound/security/two-step/backup-code-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { BackupCodesView } from '../../../../projections/two-step/backup-codes-view.projection.js';
import { reauthenticationRequired } from '../../../../services/two-step/recent-authentication.service.js';
import { lockActorSession } from '../../../../services/two-step/two-step-request.service.js';
import { summarizeTwoStepChange } from '../../../../services/two-step/two-step-view.service.js';
import type { RegenerateBackupCodesInput } from './regenerate-backup-codes.input.js';

/**
 * Class RegenerateBackupCodes
 *
 * @description
 * Replaces the backup codes of the account with 10 new ones (`POST .../backup-codes/regenerate`,
 * decision 7 of P2c, "Nouveaux codes de secours"). After the account and the session: two-step
 * verification must be on (`auth.two-step-not-enabled`), then the recent authentication of the
 * session (`auth.reauthentication-required`). In one transaction the previous codes stop working,
 * the new ones are stored as keyed hashes and returned once, the account takes the next version and
 * `user.two-step-verification-changed.v1` (`change: backup-codes-regenerated`) is appended, without
 * the codes.
 */
export class RegenerateBackupCodes {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the regeneration.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property sessions
   *
   * @description
   * The sessions of the person.
   *
   * @type {AccountSessions}
   * @readonly
   */
  private readonly sessions: AccountSessions;

  /**
   * Property backupCodeSecrets
   *
   * @description
   * Draws and hashes the codes.
   *
   * @type {BackupCodeSecrets}
   * @readonly
   */
  private readonly backupCodeSecrets: BackupCodeSecrets;

  /**
   * Property devices
   *
   * @description
   * Reads the device of the browser for the event.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

  /**
   * Property clock
   *
   * @description
   * The time of the regeneration.
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
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the regeneration.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {BackupCodeSecrets} backupCodeSecrets - Draws and hashes the codes.
   * @param {DeviceReader} devices - Reads the device of the browser for the event.
   * @param {Clock} clock - The time of the regeneration.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    backupCodeSecrets: BackupCodeSecrets,
    devices: DeviceReader,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.backupCodeSecrets = backupCodeSecrets;
    this.devices = devices;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Regenerates the codes.
   *
   * @param {RegenerateBackupCodesInput} input - The actor, the account, the session and the browser.
   * @returns {Promise<BackupCodesView>} The new codes, returned once.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `auth.two-step-not-enabled` or `auth.reauthentication-required`.
   */
  public async execute(input: RegenerateBackupCodesInput): Promise<BackupCodesView> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: AccountsStore): Promise<BackupCodesView> => {
      const located = await lockActorSession(store, this.sessions, input);
      if ('reason' in located) {
        throw new AccountRefusal(located);
      }
      const user: User = located.user;
      const verification: TwoStepVerification | null = await store.twoStep.lock(user.id);
      if (verification === null) {
        throw new AccountRefusal({ reason: 'two-step-not-enabled' });
      }
      if (!located.recent) {
        throw new AccountRefusal(await reauthenticationRequired(store, user.id));
      }
      const codes: string[] = this.backupCodeSecrets.generate();
      const hashes: string[] = codes.map((code: string): string => {
        const hash: string | null = this.backupCodeSecrets.hashOf(user.id, code);
        if (hash === null) {
          throw new Error('A generated backup code is malformed.');
        }
        return hash;
      });
      await store.backupCodes.replaceAll(user.id, hashes);
      await store.twoStep.update(verification.regenerateBackupCodes(now));
      const changed: User = user.changeTwoStepVerification();
      await store.users.update(changed);
      await store.events.userTwoStepVerificationChanged(
        changed,
        await summarizeTwoStepChange(store, user.id, 'backup-codes-regenerated', null),
        toClientDescription(this.devices, input.client),
      );
      return { codes, generatedAt: now };
    });
  }
  // #endregion
}
