import { eventSchemas } from '@cadenway/contracts/events/identity-service';
import type { TransactionScope } from '@cadenway/nest-common/database';
import type { OutboxWriter } from '@cadenway/nest-messaging/outbox';

import type { IssuedCode } from '../../../../application/models/authentication/issued-code.model.js';
import type { IssuedResetLink } from '../../../../application/models/password-reset/issued-reset-link.model.js';
import type { ClientDescription } from '../../../../application/models/sessions/client-description.model.js';
import type { AccountEvents } from '../../../../application/ports/outbound/messaging/accounts/account-events.port.js';
import type { User } from '../../../../domain/aggregates/account/user.aggregate.js';
import type { EmailAddress } from '../../../../domain/value-objects/email/email-address.value-object.js';

/**
 * Constant SERVICE_ACTOR
 *
 * @description
 * The actor of a code asked before any session exists: the service itself, since anyone can ask a
 * code for any address (`one-time-code.issued.v1`).
 *
 * @type {{ readonly type: 'system'; readonly id: 'identity-service' }}
 */
const SERVICE_ACTOR: { readonly type: 'system'; readonly id: 'identity-service' } = {
  type: 'system',
  id: 'identity-service',
};

/**
 * Class OutboxAccountEvents
 *
 * @description
 * `AccountEvents` on the outbox of `@cadenway/nest-messaging`, in the transaction of its unit of
 * work: the payload is validated with the schemas of `@cadenway/contracts/events/identity-service`
 * and PostgreSQL assigns the event id and instant. Every event has `organizationId: null`, so the
 * transaction is a system one. `one-time-code.issued.v1` is listed in `restrictedEvents` of the
 * messaging module: the writer routes it to `restricted.one-time-code.issued.v1` in
 * `EVENTS_RESTRICTED`, which notification-service alone reads.
 */
export class OutboxAccountEvents implements AccountEvents {
  // #region Properties
  /**
   * Property transaction
   *
   * @description
   * The transaction the events are appended in.
   *
   * @type {TransactionScope}
   * @readonly
   */
  private readonly transaction: TransactionScope;

  /**
   * Property outbox
   *
   * @description
   * The outbox writer of the kit.
   *
   * @type {OutboxWriter}
   * @readonly
   */
  private readonly outbox: OutboxWriter;

  /**
   * Property onAppend
   *
   * @description
   * Called after each append, so the unit of work wakes the relay once it commits.
   *
   * @type {() => void}
   * @readonly
   */
  private readonly onAppend: () => void;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the events to a transaction.
   *
   * @param {TransactionScope} transaction - The transaction the events are appended in.
   * @param {OutboxWriter} outbox - The outbox writer of the kit.
   * @param {() => void} onAppend - Called after each append.
   * @constructor
   */
  public constructor(transaction: TransactionScope, outbox: OutboxWriter, onAppend: () => void) {
    this.transaction = transaction;
    this.outbox = outbox;
    this.onAppend = onAppend;
  }
  // #endregion

  // #region Methods
  /**
   * Method userSignedUp
   *
   * @description
   * Appends `user.signed-up.v1`; its actor is the new user.
   *
   * @param {User} user - The account after the sign-up.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async userSignedUp(user: User): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.signed-up.v1', {
      organizationId: null,
      actor: { type: 'user', id: user.id },
      version: user.version,
      userId: user.id,
      email: user.email.value,
      name: user.name,
      language: user.language,
    });
    this.onAppend();
  }

  /**
   * Method userEmailVerified
   *
   * @description
   * Appends `user.email-verified.v1`; its actor is the user.
   *
   * @param {User} user - The account after the verification.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async userEmailVerified(user: User): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.email-verified.v1', {
      organizationId: null,
      actor: { type: 'user', id: user.id },
      version: user.version,
      userId: user.id,
      email: user.email.value,
    });
    this.onAppend();
  }

  /**
   * Method userProfileUpdated
   *
   * @description
   * Appends `user.profile-updated.v1`; its actor is the user. It carries the profile, never the
   * address, a password or a code.
   *
   * @param {User} user - The account after the change.
   * @param {readonly string[]} changed - The members that moved.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async userProfileUpdated(user: User, changed: readonly string[]): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.profile-updated.v1', {
      organizationId: null,
      actor: { type: 'user', id: user.id },
      version: user.version,
      userId: user.id,
      name: user.name,
      displayName: user.displayName,
      jobTitle: user.jobTitle,
      timeZone: user.timeZone,
      language: user.language,
      changed: [...changed],
    });
    this.onAppend();
  }

  /**
   * Method oneTimeCodeIssued
   *
   * @description
   * Appends the restricted `one-time-code.issued.v1` at version 1, as the contract fixes it ("a
   * code never changes, a new code is a new `codeId`"): its later attempts and use stay internal.
   *
   * @param {IssuedCode} issued - The code and its recipient.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async oneTimeCodeIssued(issued: IssuedCode): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'one-time-code.issued.v1', {
      organizationId: null,
      actor: issued.requestedByUser ? { type: 'user', id: issued.user.id } : SERVICE_ACTOR,
      version: 1,
      codeId: issued.codeId,
      userId: issued.user.id,
      purpose: issued.purpose,
      code: issued.code,
      expiresAt: issued.expiresAt.toISOString(),
      recipient: { email: issued.recipient.value, name: issued.user.name },
      language: issued.user.language,
    });
    this.onAppend();
  }

  /**
   * Method passwordResetLinkIssued
   *
   * @description
   * Appends the restricted `password-reset-link.issued.v1`, credited to identity-service: anyone
   * can ask a link for any address. The token is in this payload and in the outbox row until the
   * relay publishes it on `restricted.`, which then keeps a redacted envelope only.
   *
   * @param {IssuedResetLink} issued - The link and its recipient.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async passwordResetLinkIssued(issued: IssuedResetLink): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'password-reset-link.issued.v1', {
      organizationId: null,
      actor: SERVICE_ACTOR,
      version: 1,
      linkId: issued.linkId,
      userId: issued.user.id,
      token: issued.token,
      expiresAt: issued.expiresAt.toISOString(),
      client: { device: { ...issued.client.device }, ipAddress: issued.client.ipAddress },
      recipient: { email: issued.user.email.value, name: issued.user.name },
      language: issued.user.language,
      timeZone: issued.user.timeZone,
    });
    this.onAppend();
  }

  /**
   * Method userPasswordChanged
   *
   * @description
   * Appends `user.password-changed.v1`, credited to the user: the reset link proves the account.
   *
   * @param {User} user - The account after the change.
   * @param {'change' | 'reset'} method - From a session, or with a reset link.
   * @param {number} closedSessionCount - The sessions the change closed.
   * @param {ClientDescription} client - The browser the password was set in.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async userPasswordChanged(
    user: User,
    method: 'change' | 'reset',
    closedSessionCount: number,
    client: ClientDescription,
  ): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.password-changed.v1', {
      organizationId: null,
      actor: { type: 'user', id: user.id },
      version: user.version,
      userId: user.id,
      method,
      closedSessionCount,
      client: { device: { ...client.device }, ipAddress: client.ipAddress },
      recipient: { email: user.email.value, name: user.name },
      language: user.language,
      timeZone: user.timeZone,
    });
    this.onAppend();
  }

  /**
   * Method userEmailChanged
   *
   * @description
   * Appends `user.email-changed.v1`.
   *
   * @param {User} user - The account with its new address.
   * @param {EmailAddress} previousEmail - The address before the change.
   * @param {ClientDescription} client - The browser the address was confirmed in.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async userEmailChanged(
    user: User,
    previousEmail: EmailAddress,
    client: ClientDescription,
  ): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.email-changed.v1', {
      organizationId: null,
      actor: { type: 'user', id: user.id },
      version: user.version,
      userId: user.id,
      email: user.email.value,
      previousEmail: previousEmail.value,
      name: user.name,
      client: { device: { ...client.device }, ipAddress: client.ipAddress },
      language: user.language,
      timeZone: user.timeZone,
    });
    this.onAppend();
  }

  /**
   * Method userDeletionScheduled
   *
   * @description
   * Appends `user.deletion-scheduled.v1`.
   *
   * @param {User} user - The account, its deletion scheduled.
   * @returns {Promise<void>} Resolves once appended.
   * @throws {Error} When the account has no scheduled deletion: a defect of the caller.
   */
  public async userDeletionScheduled(user: User): Promise<void> {
    if (user.deleteAt === null) {
      throw new Error('The scheduled deletion of the account is missing.');
    }
    await this.outbox.append(this.transaction, eventSchemas, 'user.deletion-scheduled.v1', {
      organizationId: null,
      actor: { type: 'user', id: user.id },
      version: user.version,
      userId: user.id,
      deleteAt: user.deleteAt.toISOString(),
      recipient: { email: user.email.value, name: user.name },
      language: user.language,
      timeZone: user.timeZone,
    });
    this.onAppend();
  }

  /**
   * Method userDeletionCancelled
   *
   * @description
   * Appends `user.deletion-cancelled.v1`.
   *
   * @param {User} user - The account, its deletion cancelled.
   * @param {string} sessionId - The session the sign-in opened.
   * @param {ClientDescription} client - The browser that signed in.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async userDeletionCancelled(
    user: User,
    sessionId: string,
    client: ClientDescription,
  ): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.deletion-cancelled.v1', {
      organizationId: null,
      actor: { type: 'user', id: user.id },
      version: user.version,
      userId: user.id,
      sessionId,
      client: { device: { ...client.device }, ipAddress: client.ipAddress },
      recipient: { email: user.email.value, name: user.name },
      language: user.language,
      timeZone: user.timeZone,
    });
    this.onAppend();
  }

  /**
   * Method userDeleted
   *
   * @description
   * Appends `user.deleted.v1`, credited to identity-service, with the ids only.
   *
   * @param {string} userId - The deleted account.
   * @param {number} version - The version of the account after the deletion.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async userDeleted(userId: string, version: number): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'user.deleted.v1', {
      organizationId: null,
      actor: SERVICE_ACTOR,
      version,
      userId,
    });
    this.onAppend();
  }
  // #endregion
}
