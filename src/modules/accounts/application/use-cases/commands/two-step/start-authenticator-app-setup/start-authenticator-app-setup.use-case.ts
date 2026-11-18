import { TWO_STEP_LIMITS } from '../../../../../domain/policies/two-step/two-step-limits.policy.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { AuthenticatorAppSecrets } from '../../../../ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import type { Totp } from '../../../../ports/outbound/security/two-step/totp.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { AuthenticatorAppSetupView } from '../../../../projections/two-step/authenticator-app-setup-view.projection.js';
import { reauthenticationRequired } from '../../../../services/two-step/recent-authentication.service.js';
import { lockActorSession } from '../../../../services/two-step/two-step-request.service.js';
import type { StartAuthenticatorAppSetupInput } from './start-authenticator-app-setup.input.js';

/**
 * Class StartAuthenticatorAppSetup
 *
 * @description
 * Starts the setup of an authenticator app (`POST
 * .../two-step-verification/authenticator-app/setup`, decision 7 of P2c): after the account and the
 * session, the recent authentication of the session (`auth.reauthentication-required`: a stolen
 * session cannot enroll a factor of its own); then a new TOTP secret of 160 random bits, sealed,
 * becomes the pending setup of the session for 15 minutes, in place of the previous one. The secret
 * and its `otpauth://` URI are returned once; the current app, if any, keeps working until the
 * confirmation.
 */
export class StartAuthenticatorAppSetup {
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
   * Property appSecrets
   *
   * @description
   * Draws and seals the secret.
   *
   * @type {AuthenticatorAppSecrets}
   * @readonly
   */
  private readonly appSecrets: AuthenticatorAppSecrets;

  /**
   * Property totp
   *
   * @description
   * Writes the URI of the secret.
   *
   * @type {Totp}
   * @readonly
   */
  private readonly totp: Totp;

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
   * @param {AuthenticatorAppSecrets} appSecrets - Draws and seals the secret.
   * @param {Totp} totp - Writes the URI of the secret.
   * @param {Clock} clock - The time of the start.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    appSecrets: AuthenticatorAppSecrets,
    totp: Totp,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.appSecrets = appSecrets;
    this.totp = totp;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Starts the setup.
   *
   * @param {StartAuthenticatorAppSetupInput} input - The actor, the account and the session.
   * @returns {Promise<AuthenticatorAppSetupView>} The secret, its URI and the expiry of the setup.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found` or `auth.reauthentication-required`.
   */
  public async execute(input: StartAuthenticatorAppSetupInput): Promise<AuthenticatorAppSetupView> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: AccountsStore): Promise<AuthenticatorAppSetupView> => {
      const located = await lockActorSession(store, this.sessions, input);
      if ('reason' in located) {
        throw new AccountRefusal(located);
      }
      if (!located.recent) {
        throw new AccountRefusal(await reauthenticationRequired(store, located.user.id));
      }
      const secret: string = this.appSecrets.generate();
      const expiresAt: Date = new Date(now.getTime() + TWO_STEP_LIMITS.setupLifetimeMs);
      await store.pendingTwoStep.putSetup(located.user.id, {
        sessionId: input.sessionId,
        value: this.appSecrets.seal(located.user.id, secret),
        expiresAt,
      });
      return { secret, otpauthUri: this.totp.uriOf(secret, located.user.email.value), expiresAt };
    });
  }
  // #endregion
}
