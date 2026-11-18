import type { TenantTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';
import type { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';

import type { SessionsStore } from '../../../../../application/models/session/sessions-store.model.js';
import type { SessionsUnitOfWork } from '../../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { OutboxSessionEvents } from '../../../../messaging/outbox/session/outbox-session-events.adapter.js';
import { DrizzleOrganizationChoiceRepository } from '../../repositories/session/drizzle-organization-choice.repository.js';
import { DrizzleSessionRepository } from '../../repositories/session/drizzle-session.repository.js';

/**
 * Class TenantSessionsUnitOfWork
 *
 * @description
 * `SessionsUnitOfWork` on the tenant transaction runner of `@cadenway/nest-common/database`, for
 * the one read of a session made while serving a request that carries an organization: the check
 * of the recent authentication of the creation of a personal API token, which joins the tenant
 * transaction of that creation. The runner takes the organization from the verified context, never
 * from an argument, and the forced policy of `sessions` shows only the sessions that act on it; the
 * query still names its session by id and the use case compares the owner. Nothing is written
 * through it.
 */
export class TenantSessionsUnitOfWork implements SessionsUnitOfWork {
  // #region Properties
  /**
   * Property runner
   *
   * @description
   * The tenant transaction runner of the kit.
   *
   * @type {TenantTransactionRunner}
   * @readonly
   */
  private readonly runner: TenantTransactionRunner;

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
   * Property relay
   *
   * @description
   * The outbox relay.
   *
   * @type {OutboxRelay}
   * @readonly
   */
  private readonly relay: OutboxRelay;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the runner and the outbox of the kit.
   *
   * @param {TenantTransactionRunner} runner - The tenant transaction runner.
   * @param {OutboxWriter} outbox - The outbox writer.
   * @param {OutboxRelay} relay - The outbox relay.
   * @constructor
   */
  public constructor(runner: TenantTransactionRunner, outbox: OutboxWriter, relay: OutboxRelay) {
    this.runner = runner;
    this.outbox = outbox;
    this.relay = relay;
  }
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in the tenant transaction of the organization of the context, joining the current
   * one when called inside it.
   *
   * @param {(store: SessionsStore) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  public async run<TResult>(work: (store: SessionsStore) => Promise<TResult>): Promise<TResult> {
    const appends: { count: number } = { count: 0 };
    const result: TResult = await this.runner.run(
      (transaction: TransactionScope): Promise<TResult> =>
        work({
          sessions: new DrizzleSessionRepository(transaction.db),
          organizationChoices: new DrizzleOrganizationChoiceRepository(transaction.db),
          events: new OutboxSessionEvents(transaction, this.outbox, (): void => {
            appends.count += 1;
          }),
        }),
    );
    if (appends.count > 0) {
      this.relay.wake();
    }
    return result;
  }
  // #endregion
}
