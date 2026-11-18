import type { SystemTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';
import type { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';

import type { SessionsStore } from '../../../../../application/models/session/sessions-store.model.js';
import type { SessionsUnitOfWork } from '../../../../../application/ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import { OutboxSessionEvents } from '../../../../messaging/outbox/session/outbox-session-events.adapter.js';
import { DrizzleAuthenticationPolicyRepository } from '../../repositories/authentication-policy/drizzle-authentication-policy.repository.js';
import { DrizzleOrganizationChoiceRepository } from '../../repositories/session/drizzle-organization-choice.repository.js';
import { DrizzleSessionRepository } from '../../repositories/session/drizzle-session.repository.js';
import { DrizzleTrustedDeviceRepository } from '../../repositories/session/drizzle-trusted-device.repository.js';
import { DrizzleTwoStepEnrollmentRepository } from '../../repositories/session/drizzle-two-step-enrollment.repository.js';

/**
 * Class SystemSessionsUnitOfWork
 *
 * @description
 * `SessionsUnitOfWork` on the system transaction runner of `@cadenway/nest-common/database`, for
 * the reasons of the accounts module: no route of this module has an organization in its internal
 * token, the tenant runner refuses to run without one, a session is opened inside the system
 * transaction of a sign-in, and `session.revoked.v1` is appended with `organizationId: null`. Every
 * query names its session by id or token hash, or its choice by account, and a user reaches only
 * its own sessions because the use case compares the owner; the system access lifts the policy of
 * `sessions.organization_id` and `organization_choices.organization_id` for these named rows only.
 * The copy of the memberships, read through its port inside `run`, joins the same transaction.
 * Inside the system transaction of a sign-in, `run` joins it. A run that appended events wakes the
 * relay once it resolves.
 */
export class SystemSessionsUnitOfWork implements SessionsUnitOfWork {
  // #region Properties
  /**
   * Property runner
   *
   * @description
   * The system transaction runner of the kit.
   *
   * @type {SystemTransactionRunner}
   * @readonly
   */
  private readonly runner: SystemTransactionRunner;

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
   * The outbox relay, woken after a commit that appended events.
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
   * @param {SystemTransactionRunner} runner - The system transaction runner.
   * @param {OutboxWriter} outbox - The outbox writer.
   * @param {OutboxRelay} relay - The outbox relay.
   * @constructor
   */
  public constructor(runner: SystemTransactionRunner, outbox: OutboxWriter, relay: OutboxRelay) {
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
   * Runs `work` in one system transaction, joining the current one when called inside it.
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
          policies: new DrizzleAuthenticationPolicyRepository(transaction.db),
          trustedDevices: new DrizzleTrustedDeviceRepository(transaction.db),
          enrollments: new DrizzleTwoStepEnrollmentRepository(transaction.db),
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
