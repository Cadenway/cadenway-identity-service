import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { TwoStepVerification } from '../../../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import { isPendingFor } from '../../../../../domain/policies/two-step/pending-two-step-start.policy.js';
import type { PendingTwoStepStart } from '../../../../../domain/value-objects/two-step/pending-two-step-start.value-object.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { TwoStepEnrollments } from '../../../../ports/outbound/identity/sessions/two-step-enrollments.port.js';
import type { TwoStepRequirements } from '../../../../ports/outbound/identity/sessions/two-step-requirements.port.js';
import type { AuthenticatorAppSecrets } from '../../../../ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import type { BackupCodeSecrets } from '../../../../ports/outbound/security/two-step/backup-code-secrets.port.js';
import type { Totp } from '../../../../ports/outbound/security/two-step/totp.port.js';
import type { WebAuthn } from '../../../../ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { AuthenticatorAppConfiguredView } from '../../../../projections/two-step/authenticator-app-configured-view.projection.js';
import type { BackupCodesView } from '../../../../projections/two-step/backup-codes-view.projection.js';
import { lockActorSession } from '../../../../services/two-step/two-step-request.service.js';
import {
  summarizeTwoStepChange,
  toTwoStepVerificationView,
} from '../../../../services/two-step/two-step-view.service.js';
import type { ConfirmAuthenticatorAppSetupInput } from './confirm-authenticator-app-setup.input.js';

/**
 * Class ConfirmAuthenticatorAppSetup
 *
 * @description
 * Confirms the pending authenticator app of the session with one of its codes (`POST
 * .../authenticator-app/setup/confirmation`, decision 7 of P2c). After the account and the session:
 * no pending setup of the session, or an expired one, answers `auth.two-step-setup-expired`; a
 * wrong code `auth.two-step-code-invalid`, not counted. Then, in one transaction:
 *
 * - two-step verification off: it turns on with the app (the code's time step accepted, so it
 *   cannot be replayed), a new WebAuthn handle and 10 new backup codes returned once; the sessions
 *   module learns it (`TwoStepEnrollments`) and the windows the other sessions opened with a
 *   password end (`change: enabled`);
 * - on: the new app replaces the previous one, the backup codes, the keys and the handle stay
 *   (`backupCodes: null`, `change: authenticator-app-replaced`);
 * - both: the setup ends, the session records a recent authentication by a second factor, the
 *   account takes the next version and `user.two-step-verification-changed.v1` is appended.
 *
 * Recent authentication is not required again: the start required it.
 */
export class ConfirmAuthenticatorAppSetup {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the confirmation.
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
   * Property appSecrets
   *
   * @description
   * Opens the sealed secret.
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
   * Property backupCodeSecrets
   *
   * @description
   * Draws and hashes the backup codes.
   *
   * @type {BackupCodeSecrets}
   * @readonly
   */
  private readonly backupCodeSecrets: BackupCodeSecrets;

  /**
   * Property webAuthn
   *
   * @description
   * Draws the WebAuthn handle of the account.
   *
   * @type {WebAuthn}
   * @readonly
   */
  private readonly webAuthn: WebAuthn;

  /**
   * Property enrollments
   *
   * @description
   * Tells the sessions module that two-step verification turned on.
   *
   * @type {TwoStepEnrollments}
   * @readonly
   */
  private readonly enrollments: TwoStepEnrollments;

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
   * The time of the confirmation.
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
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the confirmation.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {AuthenticatorAppSecrets} appSecrets - Opens the sealed secret.
   * @param {Totp} totp - Checks the code.
   * @param {BackupCodeSecrets} backupCodeSecrets - Draws and hashes the backup codes.
   * @param {WebAuthn} webAuthn - Draws the WebAuthn handle of the account.
   * @param {TwoStepEnrollments} enrollments - Tells the sessions module that two-step verification turned on.
   * @param {TwoStepRequirements} requirements - The policies of the organizations of the account.
   * @param {DeviceReader} devices - Reads the device of the browser for the event.
   * @param {Clock} clock - The time of the confirmation.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    appSecrets: AuthenticatorAppSecrets,
    totp: Totp,
    backupCodeSecrets: BackupCodeSecrets,
    webAuthn: WebAuthn,
    enrollments: TwoStepEnrollments,
    requirements: TwoStepRequirements,
    devices: DeviceReader,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.appSecrets = appSecrets;
    this.totp = totp;
    this.backupCodeSecrets = backupCodeSecrets;
    this.webAuthn = webAuthn;
    this.enrollments = enrollments;
    this.requirements = requirements;
    this.devices = devices;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Confirms the app.
   *
   * @param {ConfirmAuthenticatorAppSetupInput} input - The actor, the account, the session, the code and the browser.
   * @returns {Promise<AuthenticatorAppConfiguredView>} The card after the confirmation, and the backup codes when it turned on.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `auth.two-step-setup-expired` or `auth.two-step-code-invalid`.
   */
  public async execute(
    input: ConfirmAuthenticatorAppSetupInput,
  ): Promise<AuthenticatorAppConfiguredView> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (store: AccountsStore): Promise<AuthenticatorAppConfiguredView> => {
        const located = await lockActorSession(store, this.sessions, input);
        if ('reason' in located) {
          throw new AccountRefusal(located);
        }
        const user: User = located.user;
        const pending: PendingTwoStepStart | null = await store.pendingTwoStep.findSetup(user.id);
        if (!isPendingFor(pending, input.sessionId, now)) {
          throw new AccountRefusal({ reason: 'two-step-setup-expired' });
        }
        const timeStep: number | null = await this.totp.verify(
          this.appSecrets.open(user.id, pending.value),
          input.code,
          now,
          null,
        );
        if (timeStep === null) {
          throw new AccountRefusal({ reason: 'two-step-code-invalid', remainingAttempts: null });
        }
        const current: TwoStepVerification | null = await store.twoStep.lock(user.id);
        let backupCodes: BackupCodesView | null = null;
        if (current === null) {
          await store.twoStep.insert(
            TwoStepVerification.enable(
              user.id,
              pending.value,
              timeStep,
              this.webAuthn.newUserHandle(),
              now,
            ),
          );
          const codes: string[] = this.backupCodeSecrets.generate();
          await store.backupCodes.replaceAll(
            user.id,
            codes.map((code: string): string => this.hashOf(user.id, code)),
          );
          await this.enrollments.record(user.id, true);
          await this.sessions.endRecentAuthentication(user.id, input.sessionId, 'password-windows');
          backupCodes = { codes, generatedAt: now };
        } else {
          await store.twoStep.update(current.replaceAuthenticatorApp(pending.value, timeStep, now));
        }
        await store.pendingTwoStep.deleteSetup(user.id);
        if ((await this.sessions.authenticate(user.id, input.sessionId, 'two-step')) === null) {
          throw new AccountRefusal({ reason: 'session-not-found' });
        }
        const changed: User = user.changeTwoStepVerification();
        await store.users.update(changed);
        await store.events.userTwoStepVerificationChanged(
          changed,
          await summarizeTwoStepChange(
            store,
            user.id,
            current === null ? 'enabled' : 'authenticator-app-replaced',
            null,
          ),
          toClientDescription(this.devices, input.client),
        );
        return {
          twoStepVerification: await toTwoStepVerificationView(store, this.requirements, user.id),
          backupCodes,
        };
      },
    );
  }

  /**
   * Method hashOf
   *
   * @description
   * The keyed hash of a backup code this use case drew, always well formed.
   *
   * @param {string} userId - The account.
   * @param {string} code - The code.
   * @returns {string} The hash.
   * @throws {Error} When the generator drew a malformed code, which it never does.
   */
  private hashOf(userId: string, code: string): string {
    const hash: string | null = this.backupCodeSecrets.hashOf(userId, code);
    if (hash === null) {
      throw new Error('A generated backup code is malformed.');
    }
    return hash;
  }
  // #endregion
}
