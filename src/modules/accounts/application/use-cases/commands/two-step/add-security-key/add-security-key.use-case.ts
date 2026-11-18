import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { isPendingFor } from '../../../../../domain/policies/two-step/pending-two-step-start.policy.js';
import { normalizeSecurityKeyName } from '../../../../../domain/policies/two-step/security-key-name.policy.js';
import { TWO_STEP_LIMITS } from '../../../../../domain/policies/two-step/two-step-limits.policy.js';
import type { PendingTwoStepStart } from '../../../../../domain/value-objects/two-step/pending-two-step-start.value-object.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { SecurityKeyRecord } from '../../../../models/two-step/security-key-record.model.js';
import type { VerifiedRegistration } from '../../../../models/two-step/verified-registration.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { WebAuthn } from '../../../../ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { SecurityKeyView } from '../../../../projections/two-step/security-key-view.projection.js';
import { lockActorSession } from '../../../../services/two-step/two-step-request.service.js';
import { summarizeTwoStepChange } from '../../../../services/two-step/two-step-view.service.js';
import type { AddSecurityKeyInput } from './add-security-key.input.js';

/**
 * Class AddSecurityKey
 *
 * @description
 * Registers a security key from the answer of the browser to the pending registration of the
 * session (`POST .../security-keys`, decision 7 of P2c, "Clé de sécurité ajoutée"). After the
 * account and the session: no pending registration of the session, or an expired one, answers
 * `auth.two-step-setup-expired`; two-step verification turned off since, or 10 keys,
 * `auth.two-step-not-enabled` or `auth.security-key-limit-reached`; an answer that does not verify,
 * or a credential id any account already has, `auth.security-key-refused`. Then, in one
 * transaction, the key is stored under its trimmed name (credential id, public key, counter,
 * transports and flags), the registration ends, the account takes the next version and
 * `user.two-step-verification-changed.v1` (`change: security-key-added`) is appended. Recent
 * authentication is not required again: the start required it.
 */
export class AddSecurityKey {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the registration.
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
   * Property webAuthn
   *
   * @description
   * Verifies the answer of the browser.
   *
   * @type {WebAuthn}
   * @readonly
   */
  private readonly webAuthn: WebAuthn;

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
   * The time of the registration.
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
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the registration.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {WebAuthn} webAuthn - Verifies the answer of the browser.
   * @param {DeviceReader} devices - Reads the device of the browser for the event.
   * @param {Clock} clock - The time of the registration.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    webAuthn: WebAuthn,
    devices: DeviceReader,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.webAuthn = webAuthn;
    this.devices = devices;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Registers the key.
   *
   * @param {AddSecurityKeyInput} input - The actor, the account, the session, the name, the answer and the browser.
   * @returns {Promise<SecurityKeyView>} The new key.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `auth.two-step-setup-expired`, `auth.two-step-not-enabled`, `auth.security-key-limit-reached` or `auth.security-key-refused`.
   */
  public async execute(input: AddSecurityKeyInput): Promise<SecurityKeyView> {
    const now: Date = this.clock.now();
    const name: string = normalizeSecurityKeyName(input.name);
    return this.unitOfWork.run(async (store: AccountsStore): Promise<SecurityKeyView> => {
      const located = await lockActorSession(store, this.sessions, input);
      if ('reason' in located) {
        throw new AccountRefusal(located);
      }
      const user: User = located.user;
      const pending: PendingTwoStepStart | null = await store.pendingTwoStep.findRegistration(
        user.id,
      );
      if (!isPendingFor(pending, input.sessionId, now)) {
        throw new AccountRefusal({ reason: 'two-step-setup-expired' });
      }
      if ((await store.twoStep.lock(user.id)) === null) {
        throw new AccountRefusal({ reason: 'two-step-not-enabled' });
      }
      const keys: SecurityKeyRecord[] = await store.securityKeys.listOfUser(user.id);
      if (keys.length >= TWO_STEP_LIMITS.maxSecurityKeys) {
        throw new AccountRefusal({
          reason: 'security-key-limit-reached',
          maxSecurityKeys: TWO_STEP_LIMITS.maxSecurityKeys,
        });
      }
      const verified: VerifiedRegistration | null = await this.webAuthn.verifyRegistration(
        input.credential,
        pending.value,
      );
      if (verified === null || (await store.securityKeys.credentialExists(verified.credentialId))) {
        throw new AccountRefusal({ reason: 'security-key-refused', remainingAttempts: null });
      }
      const key: SecurityKeyRecord = await store.securityKeys.insert(user.id, name, verified);
      await store.pendingTwoStep.deleteRegistration(user.id);
      const changed: User = user.changeTwoStepVerification();
      await store.users.update(changed);
      await store.events.userTwoStepVerificationChanged(
        changed,
        await summarizeTwoStepChange(store, user.id, 'security-key-added', {
          id: key.id,
          name: key.name,
        }),
        toClientDescription(this.devices, input.client),
      );
      return { id: key.id, name: key.name, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt };
    });
  }
  // #endregion
}
