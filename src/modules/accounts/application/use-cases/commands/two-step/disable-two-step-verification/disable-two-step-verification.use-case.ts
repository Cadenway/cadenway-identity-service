import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { TwoStepRequirement } from '../../../../models/two-step/two-step-requirement.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { TrustedDevices } from '../../../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { TwoStepEnrollments } from '../../../../ports/outbound/identity/sessions/two-step-enrollments.port.js';
import type { TwoStepRequirements } from '../../../../ports/outbound/identity/sessions/two-step-requirements.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { reauthenticationRequired } from '../../../../services/two-step/recent-authentication.service.js';
import { lockActorSession } from '../../../../services/two-step/two-step-request.service.js';
import { summarizeTwoStepChange } from '../../../../services/two-step/two-step-view.service.js';
import type { DisableTwoStepVerificationInput } from './disable-two-step-verification.input.js';

/**
 * Class DisableTwoStepVerification
 *
 * @description
 * Turns the two-step verification of the account off (`POST .../two-step-verification/disable`,
 * decisions 7 and 8 of P2c). After the account and the session: already off answers without a
 * change and emits nothing; an organization whose policy requires it for a role of the person
 * answers `auth.mfa-required-by-organization` with those organizations; then the recent
 * authentication of the session (`auth.reauthentication-required`). In one transaction the app, the
 * keys, the backup codes, the pending setup and registration and the open challenge are deleted,
 * every trusted device is forgotten, the sessions module learns it (`TwoStepEnrollments`), the
 * account takes the next version and `user.two-step-verification-changed.v1` (`change: disabled`)
 * is appended.
 */
export class DisableTwoStepVerification {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the change.
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
   * Property requirements
   *
   * @description
   * The policies of the organizations of the account.
   *
   * @type {TwoStepRequirements}
   * @readonly
   */
  private readonly requirements: TwoStepRequirements;

  /**
   * Property enrollments
   *
   * @description
   * Tells the sessions module that two-step verification turned off.
   *
   * @type {TwoStepEnrollments}
   * @readonly
   */
  private readonly enrollments: TwoStepEnrollments;

  /**
   * Property trustedDevices
   *
   * @description
   * Forgets the trusted devices of the account.
   *
   * @type {TrustedDevices}
   * @readonly
   */
  private readonly trustedDevices: TrustedDevices;

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
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the change.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {TwoStepRequirements} requirements - The policies of the organizations of the account.
   * @param {TwoStepEnrollments} enrollments - Tells the sessions module that two-step verification turned off.
   * @param {TrustedDevices} trustedDevices - Forgets the trusted devices of the account.
   * @param {DeviceReader} devices - Reads the device of the browser for the event.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    requirements: TwoStepRequirements,
    enrollments: TwoStepEnrollments,
    trustedDevices: TrustedDevices,
    devices: DeviceReader,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.requirements = requirements;
    this.enrollments = enrollments;
    this.trustedDevices = trustedDevices;
    this.devices = devices;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Turns two-step verification off.
   *
   * @param {DisableTwoStepVerificationInput} input - The actor, the account, the session and the browser.
   * @returns {Promise<void>} Resolves once off.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `auth.mfa-required-by-organization` or `auth.reauthentication-required`.
   */
  public async execute(input: DisableTwoStepVerificationInput): Promise<void> {
    await this.unitOfWork.run(async (store: AccountsStore): Promise<void> => {
      const located = await lockActorSession(store, this.sessions, input);
      if ('reason' in located) {
        throw new AccountRefusal(located);
      }
      const user: User = located.user;
      if ((await store.twoStep.lock(user.id)) === null) {
        return;
      }
      const required: readonly TwoStepRequirement[] = await this.requirements.of(user.id);
      if (required.length > 0) {
        throw new AccountRefusal({
          reason: 'mfa-required-by-organization',
          organizationIds: required.map(
            (requirement: TwoStepRequirement): string => requirement.organizationId,
          ),
        });
      }
      if (!located.recent) {
        throw new AccountRefusal(await reauthenticationRequired(store, user.id));
      }
      await store.securityKeys.deleteOfUser(user.id);
      await store.backupCodes.deleteOfUser(user.id);
      await store.pendingTwoStep.dropOfUser(user.id);
      await store.challenges.deleteOfUser(user.id);
      await store.twoStep.delete(user.id);
      await this.trustedDevices.forget(user.id);
      await this.enrollments.record(user.id, false);
      const changed: User = user.changeTwoStepVerification();
      await store.users.update(changed);
      await store.events.userTwoStepVerificationChanged(
        changed,
        await summarizeTwoStepChange(store, user.id, 'disabled', null),
        toClientDescription(this.devices, input.client),
      );
    });
  }
  // #endregion
}
