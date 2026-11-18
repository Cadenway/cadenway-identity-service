import { eventSchemas } from '@cadenway/contracts/events/identity-service';
import type { TransactionScope } from '@cadenway/nest-common/database';
import type { OutboxWriter } from '@cadenway/nest-messaging/outbox';

import type { DeviceDescription } from '../../../../application/models/session/device-description.model.js';
import type { SessionEvents } from '../../../../application/ports/outbound/messaging/session/session-events.port.js';
import type { Session } from '../../../../domain/aggregates/session/session.aggregate.js';

/**
 * Class OutboxSessionEvents
 *
 * @description
 * `SessionEvents` on the outbox of `@cadenway/nest-messaging`, in the transaction of its unit of
 * work, validated with the schemas of `@cadenway/contracts/events/identity-service`. The event
 * carries the ids only: no token, address, device or IP address.
 */
export class OutboxSessionEvents implements SessionEvents {
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
   * Method sessionRevoked
   *
   * @description
   * Appends `session.revoked.v1`; its actor is the user who revoked the session.
   *
   * @param {Session} session - The revoked session.
   * @param {string} actorUserId - The user who revoked it.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async sessionRevoked(session: Session, actorUserId: string): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'session.revoked.v1', {
      organizationId: null,
      actor: { type: 'user', id: actorUserId },
      version: session.snapshot.version,
      sessionId: session.id,
      userId: session.userId,
    });
    this.onAppend();
  }

  /**
   * Method sessionOpenedOnNewDevice
   *
   * @description
   * Appends `session.opened-on-new-device.v1`, credited to the user, with the version of the new
   * session and the device and address of its browser, never its token nor its `User-Agent`.
   *
   * @param {Session} session - The new session.
   * @param {{ readonly device: DeviceDescription; readonly ipAddress: string }} client - The
   * device and the address of the browser.
   * @param {{ readonly email: string; readonly name: string; readonly language: string; readonly timeZone: string }} notice
   * - Whom the e-mail addresses.
   * @returns {Promise<void>} Resolves once appended.
   */
  public async sessionOpenedOnNewDevice(
    session: Session,
    client: { readonly device: DeviceDescription; readonly ipAddress: string },
    notice: {
      readonly email: string;
      readonly name: string;
      readonly language: string;
      readonly timeZone: string;
    },
  ): Promise<void> {
    await this.outbox.append(this.transaction, eventSchemas, 'session.opened-on-new-device.v1', {
      organizationId: null,
      actor: { type: 'user', id: session.userId },
      version: session.snapshot.version,
      sessionId: session.id,
      userId: session.userId,
      client: { device: { ...client.device }, ipAddress: client.ipAddress },
      recipient: { email: notice.email, name: notice.name },
      language: notice.language,
      timeZone: notice.timeZone,
    });
    this.onAppend();
  }
  // #endregion
}
