import type { SystemTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';
import type { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import type { JobProducer } from '@cadenway/nest-jobs/runtime';

import type { AccountsStore } from '../../../../../application/models/transactions/accounts-store.model.js';
import type { UnitOfWorkOptions } from '../../../../../application/models/transactions/unit-of-work-options.model.js';
import type { AccountsUnitOfWork } from '../../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { JobsAccountDeletionQueue } from '../../../../jobs/pg-boss/accounts/jobs-account-deletion-queue.adapter.js';
import { OutboxAccountEvents } from '../../../../messaging/outbox/accounts/outbox-account-events.adapter.js';
import { DrizzlePasswordCredentialRepository } from '../../repositories/accounts/drizzle-password-credential.repository.js';
import { DrizzleSignInAttemptRepository } from '../../repositories/accounts/drizzle-sign-in-attempt.repository.js';
import { DrizzleUserRepository } from '../../repositories/accounts/drizzle-user.repository.js';
import { DrizzleCodeRequestRepository } from '../../repositories/authentication/drizzle-code-request.repository.js';
import { DrizzleOneTimeCodeRepository } from '../../repositories/authentication/drizzle-one-time-code.repository.js';
import { DrizzleEmailChangeRepository } from '../../repositories/email-change/drizzle-email-change.repository.js';
import { DrizzlePasswordResetLinkRepository } from '../../repositories/password-reset/drizzle-password-reset-link.repository.js';
import { DrizzlePasswordResetRequestRepository } from '../../repositories/password-reset/drizzle-password-reset-request.repository.js';
import { DrizzleBackupCodeRepository } from '../../repositories/two-step/drizzle-backup-code.repository.js';
import { DrizzlePendingTwoStepRepository } from '../../repositories/two-step/drizzle-pending-two-step.repository.js';
import { DrizzleSecurityKeyRepository } from '../../repositories/two-step/drizzle-security-key.repository.js';
import { DrizzleSignInChallengeRepository } from '../../repositories/two-step/drizzle-sign-in-challenge.repository.js';
import { DrizzleTwoStepVerificationRepository } from '../../repositories/two-step/drizzle-two-step-verification.repository.js';

/**
 * Class SystemAccountsUnitOfWork
 *
 * @description
 * `AccountsUnitOfWork` on the system transaction runner of `@cadenway/nest-common/database`. The
 * kit reserves that runner for work without an organization, and every flow of this module has
 * none: the internal token of the routes carries no organization (`organization: 'optional'`), the
 * tenant runner refuses to run without one, and the events of the module are appended with
 * `organizationId: null`, which the policy of `outbox_events` accepts in a system transaction only.
 * The tables of the module carry no organization and no policy, so the system access widens
 * nothing for them: every query names its account, address or code explicitly.
 *
 * The jobs that delete accounts are enqueued through the connection of the same transaction, so a
 * job exists if and only if the transaction commits.
 *
 * Once a run that appended events resolves, the relay is woken so they leave now instead of at its
 * next poll. A run joined to an outer transaction resolves before that one commits: the pass it
 * wakes does not see the rows yet, and the next poll, a second later, publishes them.
 */
export class SystemAccountsUnitOfWork implements AccountsUnitOfWork {
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

  /**
   * Property jobs
   *
   * @description
   * The producer of `@cadenway/nest-jobs`, which enqueues through the transaction.
   *
   * @type {JobProducer}
   * @readonly
   */
  private readonly jobs: JobProducer;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the runner, the outbox and the job producer of the kit.
   *
   * @param {SystemTransactionRunner} runner - The system transaction runner.
   * @param {OutboxWriter} outbox - The outbox writer.
   * @param {OutboxRelay} relay - The outbox relay.
   * @param {JobProducer} jobs - The job producer.
   * @constructor
   */
  public constructor(
    runner: SystemTransactionRunner,
    outbox: OutboxWriter,
    relay: OutboxRelay,
    jobs: JobProducer,
  ) {
    this.runner = runner;
    this.outbox = outbox;
    this.relay = relay;
    this.jobs = jobs;
  }
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs `work` in one system transaction, joining the current one when called inside it.
   *
   * @param {(store: AccountsStore) => Promise<TResult>} work - The unit of work.
   * @param {UnitOfWorkOptions} options - How the transaction is opened.
   * @returns {Promise<TResult>} What the work resolved with, once committed.
   */
  public async run<TResult>(
    work: (store: AccountsStore) => Promise<TResult>,
    options: UnitOfWorkOptions = {},
  ): Promise<TResult> {
    const appends: { count: number } = { count: 0 };
    const result: TResult = await this.runner.run(
      (transaction: TransactionScope): Promise<TResult> =>
        work({
          users: new DrizzleUserRepository(transaction.db),
          credentials: new DrizzlePasswordCredentialRepository(transaction.db),
          codes: new DrizzleOneTimeCodeRepository(transaction.db),
          codeRequests: new DrizzleCodeRequestRepository(transaction.db),
          signInAttempts: new DrizzleSignInAttemptRepository(transaction.db),
          resetLinks: new DrizzlePasswordResetLinkRepository(transaction.db),
          resetRequests: new DrizzlePasswordResetRequestRepository(transaction.db),
          emailChanges: new DrizzleEmailChangeRepository(transaction.db),
          twoStep: new DrizzleTwoStepVerificationRepository(transaction.db),
          backupCodes: new DrizzleBackupCodeRepository(transaction.db),
          securityKeys: new DrizzleSecurityKeyRepository(transaction.db),
          pendingTwoStep: new DrizzlePendingTwoStepRepository(transaction.db),
          challenges: new DrizzleSignInChallengeRepository(transaction.db),
          deletionQueue: new JobsAccountDeletionQueue(transaction, this.jobs),
          events: new OutboxAccountEvents(transaction, this.outbox, (): void => {
            appends.count += 1;
          }),
        }),
      { readOnly: options.readOnly ?? false },
    );
    if (appends.count > 0) {
      this.relay.wake();
    }
    return result;
  }
  // #endregion
}
