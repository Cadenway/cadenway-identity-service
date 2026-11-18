import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { PasswordResetLink } from '../../../../../domain/aggregates/password-reset/password-reset-link.aggregate.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { CompromisedPasswords } from '../../../../ports/outbound/security/authentication/compromised-passwords.port.js';
import type { PasswordHasher } from '../../../../ports/outbound/security/authentication/password-hasher.port.js';
import type { ResetLinkSecrets } from '../../../../ports/outbound/security/password-reset/reset-link-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { dropPendingEmailChange } from '../../../../services/email-change/pending-email-change.service.js';
import {
  clearPasswordAttempts,
  refuseNewPassword,
} from '../../../../services/password/password-attempts.service.js';
import type { ConfirmPasswordResetInput } from './confirm-password-reset.input.js';
import type { ConfirmPasswordResetOutput } from './confirm-password-reset.output.js';
import type { TrustedDevices } from '../../../../ports/outbound/identity/sessions/trusted-devices.port.js';

/**
 * Class ConfirmPasswordReset
 *
 * @description
 * Sets the new password of the account of a reset link and uses the link up
 * (`POST /internal/v1/auth/password-reset/confirmation`, decision 2 of P2c). Never opens a
 * session. The checks run in this order:
 *
 * 1. The link (`auth.reset-link-expired`).
 * 2. The new password (`auth.password-too-short`, `auth.password-compromised`), which leaves the
 *    link usable. The hash is computed outside any transaction.
 *
 * Then one transaction locks the link and checks it again, uses it, sets the hash and
 * `passwordChangedAt` with the next version, ends the lockout of the address, drops a pending
 * change of address, and either revokes every open session of the account
 * (`closeOtherSessions`, each with `session.revoked.v1`) or ends their recent authentication; the
 * personal API tokens stay and a scheduled deletion stays scheduled. It voids the open challenge
 * and every pending two-step setup and key registration of the account and forgets every trusted
 * device of the account; the two-step verification stays (P2c-2). It appends
 * `user.password-changed.v1` (`method: reset`).
 */
export class ConfirmPasswordReset {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transactions of the reset.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property hasher
   *
   * @description
   * Hashes the new password.
   *
   * @type {PasswordHasher}
   * @readonly
   */
  private readonly hasher: PasswordHasher;

  /**
   * Property compromised
   *
   * @description
   * The list of compromised passwords.
   *
   * @type {CompromisedPasswords}
   * @readonly
   */
  private readonly compromised: CompromisedPasswords;

  /**
   * Property secrets
   *
   * @description
   * Hashes the token of the link.
   *
   * @type {ResetLinkSecrets}
   * @readonly
   */
  private readonly secrets: ResetLinkSecrets;

  /**
   * Property sessions
   *
   * @description
   * The sessions of the account.
   *
   * @type {AccountSessions}
   * @readonly
   */
  private readonly sessions: AccountSessions;

  /**
   * Property devices
   *
   * @description
   * Reads the device of the browser for the e-mail.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

  /**
   * Property clock
   *
   * @description
   * The time of the reset.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;

  /**
   * Property trustedDevices
   *
   * @description
   * The trusted devices of the account, forgotten by the reset.
   *
   * @type {TrustedDevices}
   * @readonly
   */
  private readonly trustedDevices: TrustedDevices;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the ports of the reset.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transactions.
   * @param {PasswordHasher} hasher - Hashes the new password.
   * @param {CompromisedPasswords} compromised - The list of compromised passwords.
   * @param {ResetLinkSecrets} secrets - Hashes the token.
   * @param {AccountSessions} sessions - The sessions of the account.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {Clock} clock - The time of the reset.
   * @param {TrustedDevices} trustedDevices - The trusted devices of the account, forgotten by the reset.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    compromised: CompromisedPasswords,
    secrets: ResetLinkSecrets,
    sessions: AccountSessions,
    devices: DeviceReader,
    clock: Clock,
    trustedDevices: TrustedDevices,
  ) {
    this.unitOfWork = unitOfWork;
    this.hasher = hasher;
    this.compromised = compromised;
    this.secrets = secrets;
    this.sessions = sessions;
    this.devices = devices;
    this.clock = clock;
    this.trustedDevices = trustedDevices;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Sets the new password with the link.
   *
   * @param {ConfirmPasswordResetInput} input - The token, the password, the choice for the other
   * sessions and the browser.
   * @returns {Promise<ConfirmPasswordResetOutput>} The address and the closed sessions.
   * @throws {AccountRefusal} `auth.reset-link-expired`, `auth.password-too-short` or
   * `auth.password-compromised`.
   */
  public async execute(input: ConfirmPasswordResetInput): Promise<ConfirmPasswordResetOutput> {
    const tokenHash: string | null = this.secrets.hashOf(input.token);
    if (tokenHash === null) {
      throw new AccountRefusal({ reason: 'reset-link-expired' });
    }
    const checkedAt: Date = this.clock.now();
    const usable: boolean = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<boolean> =>
        (await this.usableAccount(store, tokenHash, checkedAt, false)) !== null,
    );
    const refused: Refusal | null = usable
      ? await refuseNewPassword(this.compromised, input.newPassword)
      : { reason: 'reset-link-expired' };
    if (refused !== null) {
      throw new AccountRefusal(refused);
    }
    const passwordHash: string = await this.hasher.hash(input.newPassword);
    const outcome: ConfirmPasswordResetOutput | Refusal = await this.unitOfWork.run(
      (store: AccountsStore): Promise<ConfirmPasswordResetOutput | Refusal> =>
        this.reset(store, tokenHash, passwordHash, input),
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }

  /**
   * Method usableAccount
   *
   * @description
   * Finds the link of a token hash and its verified account, when the link works. To lock them,
   * the account is locked before the link, in the order of the change of address, which replaces
   * the links of the account it locked.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {string} tokenHash - SHA-256 of the token.
   * @param {Date} now - The instant of the check.
   * @param {boolean} forUpdate - Whether to lock the account and the link.
   * @returns {Promise<{ readonly link: PasswordResetLink; readonly user: User } | null>} The link
   * and its account, or `null` when the link does not work.
   */
  private async usableAccount(
    store: AccountsStore,
    tokenHash: string,
    now: Date,
    forUpdate: boolean,
  ): Promise<{ readonly link: PasswordResetLink; readonly user: User } | null> {
    const found: PasswordResetLink | null = await store.resetLinks.findByTokenHash(
      tokenHash,
      false,
    );
    if (found?.worksAt(now) !== true) {
      return null;
    }
    if (forUpdate) {
      // The lockout row of the address before the account, in the order of every sign-in: a
      // sign-in holding that row while it waits for the account would otherwise deadlock with
      // the reset. A change of address since this read voids the link, which the check below sees.
      const owner: User | null = await store.users.findById(found.snapshot.userId);
      if (owner === null) {
        return null;
      }
      await store.signInAttempts.lock(owner.email);
    }
    const user: User | null = forUpdate
      ? await store.users.lock(found.snapshot.userId)
      : await store.users.findById(found.snapshot.userId);
    const link: PasswordResetLink | null = forUpdate
      ? await store.resetLinks.findByTokenHash(tokenHash, true)
      : found;
    return user?.isVerified === true && link?.worksAt(now) === true ? { link, user } : null;
  }

  /**
   * Method reset
   *
   * @description
   * The transaction that applies the reset.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {string} tokenHash - SHA-256 of the token.
   * @param {string} passwordHash - The hash of the new password.
   * @param {ConfirmPasswordResetInput} input - The request.
   * @returns {Promise<ConfirmPasswordResetOutput | Refusal>} The outcome, or
   * `auth.reset-link-expired` when the link stopped working meanwhile.
   */
  private async reset(
    store: AccountsStore,
    tokenHash: string,
    passwordHash: string,
    input: ConfirmPasswordResetInput,
  ): Promise<ConfirmPasswordResetOutput | Refusal> {
    const now: Date = this.clock.now();
    const found: { readonly link: PasswordResetLink; readonly user: User } | null =
      await this.usableAccount(store, tokenHash, now, true);
    if (found === null) {
      return { reason: 'reset-link-expired' };
    }
    const changed: User = found.user.changePassword(now);
    await store.resetLinks.save(found.link.use(now));
    await store.credentials.save(changed.id, passwordHash);
    await store.users.update(changed);
    await clearPasswordAttempts(store, changed.email);
    await dropPendingEmailChange(store, changed.id, now);
    let closedSessionCount: number = 0;
    if (input.closeOtherSessions) {
      closedSessionCount = await this.sessions.revokeAll(changed.id, null);
    } else {
      await this.sessions.endRecentAuthentication(changed.id, null, 'every-window');
    }
    await store.challenges.deleteOfUser(changed.id);
    await store.pendingTwoStep.dropOfUser(changed.id);
    await this.trustedDevices.forget(changed.id);
    await store.events.userPasswordChanged(
      changed,
      'reset',
      closedSessionCount,
      toClientDescription(this.devices, input.client),
    );
    return { email: changed.email.value, closedSessionCount };
  }
  // #endregion
}
