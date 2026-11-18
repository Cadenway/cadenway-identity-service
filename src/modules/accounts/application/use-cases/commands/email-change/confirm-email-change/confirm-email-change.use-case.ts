import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { PendingEmailChange } from '../../../../../domain/value-objects/email-change/pending-email-change.value-object.js';
import { toAccountView } from '../../../../mappers/accounts/account-view.mapper.js';
import { toClientDescription } from '../../../../mappers/sessions/client-description.mapper.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { OneTimeCodeSecrets } from '../../../../ports/outbound/security/authentication/one-time-code-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { AccountView } from '../../../../projections/accounts/account-view.projection.js';
import { checkOneTimeCode } from '../../../../services/authentication/one-time-codes.service.js';
import { dropPendingEmailChange } from '../../../../services/email-change/pending-email-change.service.js';
import type { ConfirmEmailChangeInput } from './confirm-email-change.input.js';

/**
 * Class ConfirmEmailChange
 *
 * @description
 * Checks the `email-change` code of the pending change of the actor and makes the new address the
 * verified address of the account (`POST /internal/v1/users/{userId}/email-change/confirmation`,
 * decision 5 of P2c). In one transaction, which commits a counted wrong attempt before refusing:
 *
 * 1. The account of the path is the actor (`user.not-found`) and the session is an open session of
 *    the actor (`session.not-found`). Recent authentication is not required again.
 * 2. A pending change that the session asked for (`auth.code-invalid` without one, or from another
 *    session), then its code (`auth.code-invalid`, `auth.code-expired`).
 * 3. A verified account that took the new address since the request (`auth.email-taken`): the
 *    change is dropped. An unverified sign-up of the new address ends: its account is deleted.
 *
 * Then the address changes with the next version, the pending change ends, every current code and
 * the current reset link of the account stop working (they were sent to the previous address), the
 * sessions and the personal API tokens stay, and `user.email-changed.v1` tells the previous address
 * and organization-service.
 */
export class ConfirmEmailChange {
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
   * Property secrets
   *
   * @description
   * Hashes the candidate code.
   *
   * @type {OneTimeCodeSecrets}
   * @readonly
   */
  private readonly secrets: OneTimeCodeSecrets;

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
   * Reads the device of the browser for the notice.
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
   * Takes the ports of the confirmation.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction.
   * @param {OneTimeCodeSecrets} secrets - Hashes the candidate code.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {DeviceReader} devices - Reads the device of the browser.
   * @param {Clock} clock - The time of the confirmation.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    secrets: OneTimeCodeSecrets,
    sessions: AccountSessions,
    devices: DeviceReader,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.sessions = sessions;
    this.devices = devices;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Confirms the new address.
   *
   * @param {ConfirmEmailChangeInput} input - The person, the session, the code and the browser.
   * @returns {Promise<AccountView>} The account with its new address.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `auth.code-invalid`,
   * `auth.code-expired` or `auth.email-taken`.
   */
  public async execute(input: ConfirmEmailChangeInput): Promise<AccountView> {
    if (input.actorUserId !== input.userId) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    const now: Date = this.clock.now();
    const outcome: AccountView | Refusal = await this.unitOfWork.run(
      (store: AccountsStore): Promise<AccountView | Refusal> => this.confirm(store, input, now),
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }

  /**
   * Method confirm
   *
   * @description
   * The transaction of the confirmation; a refusal is returned, not thrown, so that a counted wrong
   * attempt or a dropped change commits.
   *
   * @param {AccountsStore} store - The repositories of the transaction.
   * @param {ConfirmEmailChangeInput} input - The request.
   * @param {Date} now - The instant of the confirmation.
   * @returns {Promise<AccountView | Refusal>} The account after the change, or the refusal.
   */
  private async confirm(
    store: AccountsStore,
    input: ConfirmEmailChangeInput,
    now: Date,
  ): Promise<AccountView | Refusal> {
    const user: User | null = await store.users.lock(input.userId);
    if (user === null) {
      return { reason: 'user-not-found' };
    }
    if ((await this.sessions.check(input.userId, input.sessionId)) === 'not-found') {
      return { reason: 'session-not-found' };
    }
    const pending: PendingEmailChange | null = await store.emailChanges.find(user.id);
    if (pending?.sessionId !== input.sessionId) {
      return { reason: 'code-invalid' };
    }
    const refusal: Refusal | null = await checkOneTimeCode(
      store,
      this.secrets,
      user,
      'email-change',
      input.code,
      now,
    );
    if (refusal !== null) {
      return refusal;
    }
    const holder: User | null = await store.users.findByEmail(pending.email, true);
    if (holder !== null && holder.id !== user.id) {
      if (holder.isVerified) {
        await dropPendingEmailChange(store, user.id, now);
        return { reason: 'email-taken' };
      }
      await store.users.delete(holder);
    }
    const changed: User = user.changeEmail(pending.email, now);
    await store.users.update(changed);
    await store.emailChanges.drop(user.id);
    await store.codes.replaceAllCurrent(user.id, now);
    await store.resetLinks.replaceCurrent(user.id, now);
    await store.events.userEmailChanged(
      changed,
      user.email,
      toClientDescription(this.devices, input.client),
    );
    return toAccountView(changed);
  }
  // #endregion
}
