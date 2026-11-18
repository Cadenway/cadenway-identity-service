import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { SecurityKeyRecord } from '../../../../models/two-step/security-key-record.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { reauthenticationRequired } from '../../../../services/two-step/recent-authentication.service.js';
import { lockActorSession } from '../../../../services/two-step/two-step-request.service.js';
import { summarizeTwoStepChange } from '../../../../services/two-step/two-step-view.service.js';
import type { RemoveSecurityKeyInput } from './remove-security-key.input.js';

/**
 * Class RemoveSecurityKey
 *
 * @description
 * Removes a security key of the account (`POST .../security-keys/{securityKeyId}/remove`, decision
 * 7 of P2c). After the account and the session: a key of another account, an unknown or a removed
 * one answers `security-key.not-found`; then the recent authentication of the session
 * (`auth.reauthentication-required`). In one transaction the key is deleted, the account takes the
 * next version and `user.two-step-verification-changed.v1` (`change: security-key-removed`) is
 * appended. The app and the other keys stay.
 */
export class RemoveSecurityKey {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the removal.
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
   * Property devices
   *
   * @description
   * Reads the device of the browser for the event.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes its ports, bound by the composition of the module.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the removal.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {DeviceReader} devices - Reads the device of the browser for the event.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    devices: DeviceReader,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.devices = devices;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Removes the key.
   *
   * @param {RemoveSecurityKeyInput} input - The actor, the account, the session, the key and the browser.
   * @returns {Promise<void>} Resolves once removed.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `security-key.not-found` or `auth.reauthentication-required`.
   */
  public async execute(input: RemoveSecurityKeyInput): Promise<void> {
    await this.unitOfWork.run(async (store: AccountsStore): Promise<void> => {
      const located = await lockActorSession(store, this.sessions, input);
      if ('reason' in located) {
        throw new AccountRefusal(located);
      }
      const user: User = located.user;
      const key: SecurityKeyRecord | null = await store.securityKeys.findOfUser(
        user.id,
        input.securityKeyId,
      );
      if (key === null) {
        throw new AccountRefusal({ reason: 'security-key-not-found' });
      }
      if (!located.recent) {
        throw new AccountRefusal(await reauthenticationRequired(store, user.id));
      }
      await store.securityKeys.delete(key.id);
      const changed: User = user.changeTwoStepVerification();
      await store.users.update(changed);
      await store.events.userTwoStepVerificationChanged(
        changed,
        await summarizeTwoStepChange(store, user.id, 'security-key-removed', {
          id: key.id,
          name: key.name,
        }),
        toClientDescription(this.devices, input.client),
      );
    });
  }
  // #endregion
}
