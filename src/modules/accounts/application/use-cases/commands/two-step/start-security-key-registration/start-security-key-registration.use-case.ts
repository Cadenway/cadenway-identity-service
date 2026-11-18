import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { TwoStepVerification } from '../../../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import { TWO_STEP_LIMITS } from '../../../../../domain/policies/two-step/two-step-limits.policy.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { SecurityKeyRecord } from '../../../../models/two-step/security-key-record.model.js';
import type { WebAuthnOptions } from '../../../../models/two-step/web-authn-options.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { WebAuthn } from '../../../../ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { WebAuthnOptionsView } from '../../../../projections/two-step/web-authn-options-view.projection.js';
import { reauthenticationRequired } from '../../../../services/two-step/recent-authentication.service.js';
import { lockActorSession } from '../../../../services/two-step/two-step-request.service.js';
import type { StartSecurityKeyRegistrationInput } from './start-security-key-registration.input.js';

/**
 * Class StartSecurityKeyRegistration
 *
 * @description
 * Starts the registration of a security key (`POST .../security-keys/registration`, decision 7 of
 * P2c, "Ajouter une clé"). After the account and the session: two-step verification must be on
 * (`auth.two-step-not-enabled`) with fewer than 10 keys (`auth.security-key-limit-reached`), then
 * the recent authentication of the session (`auth.reauthentication-required`). The WebAuthn
 * creation options, excluding the keys of the account, become the pending registration of the
 * session for 5 minutes, in place of the previous one.
 */
export class StartSecurityKeyRegistration {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the start.
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
   * Generates the creation options.
   *
   * @type {WebAuthn}
   * @readonly
   */
  private readonly webAuthn: WebAuthn;

  /**
   * Property clock
   *
   * @description
   * The time of the start.
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
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the start.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {WebAuthn} webAuthn - Generates the creation options.
   * @param {Clock} clock - The time of the start.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    webAuthn: WebAuthn,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.webAuthn = webAuthn;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Starts the registration.
   *
   * @param {StartSecurityKeyRegistrationInput} input - The actor, the account and the session.
   * @returns {Promise<WebAuthnOptionsView>} The options and their expiry.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `auth.two-step-not-enabled`, `auth.security-key-limit-reached` or `auth.reauthentication-required`.
   */
  public async execute(input: StartSecurityKeyRegistrationInput): Promise<WebAuthnOptionsView> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: AccountsStore): Promise<WebAuthnOptionsView> => {
      const located = await lockActorSession(store, this.sessions, input);
      if ('reason' in located) {
        throw new AccountRefusal(located);
      }
      const user: User = located.user;
      const verification: TwoStepVerification | null = await store.twoStep.lock(user.id);
      if (verification === null) {
        throw new AccountRefusal({ reason: 'two-step-not-enabled' });
      }
      const keys: SecurityKeyRecord[] = await store.securityKeys.listOfUser(user.id);
      if (keys.length >= TWO_STEP_LIMITS.maxSecurityKeys) {
        throw new AccountRefusal({
          reason: 'security-key-limit-reached',
          maxSecurityKeys: TWO_STEP_LIMITS.maxSecurityKeys,
        });
      }
      if (!located.recent) {
        throw new AccountRefusal(await reauthenticationRequired(store, user.id));
      }
      const options: WebAuthnOptions = await this.webAuthn.registrationOptions(
        verification.webauthnUserHandle,
        user.email.value,
        user.name,
        keys.map((key: SecurityKeyRecord) => ({
          id: key.credentialId,
          transports: key.transports,
        })),
      );
      const expiresAt: Date = new Date(now.getTime() + TWO_STEP_LIMITS.registrationLifetimeMs);
      await store.pendingTwoStep.putRegistration(user.id, {
        sessionId: input.sessionId,
        value: options.challenge,
        expiresAt,
      });
      return { options: options.options, expiresAt };
    });
  }
  // #endregion
}
