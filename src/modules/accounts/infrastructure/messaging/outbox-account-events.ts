import { eventSchemas } from '@cadenway/contracts/events/identity-service';
import type { TransactionScope } from '@cadenway/nest-common/database';
import type { OutboxWriter } from '@cadenway/nest-messaging/outbox';

import type { AccountEvents, IssuedCode } from '../../application/ports/account-events.port.js';
import type { User } from '../../domain/user.js';

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
      actor: SERVICE_ACTOR,
      version: 1,
      codeId: issued.codeId,
      userId: issued.user.id,
      purpose: issued.purpose,
      code: issued.code,
      expiresAt: issued.expiresAt.toISOString(),
      recipient: { email: issued.user.email.value, name: issued.user.name },
      language: issued.user.language,
    });
    this.onAppend();
  }
  // #endregion
}
