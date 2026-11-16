import type { SystemTransactionRunner, TransactionScope } from '@cadenway/nest-common/database';
import type { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';

import type { AccountsStore } from '../../../../../application/models/transactions/accounts-store.model.js';
import type { UnitOfWorkOptions } from '../../../../../application/models/transactions/unit-of-work-options.model.js';
import type { AccountsUnitOfWork } from '../../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { OutboxAccountEvents } from '../../../../messaging/outbox/accounts/outbox-account-events.adapter.js';
import { DrizzlePasswordCredentialRepository } from '../../repositories/accounts/drizzle-password-credential.repository.js';
import { DrizzleSignInAttemptRepository } from '../../repositories/accounts/drizzle-sign-in-attempt.repository.js';
import { DrizzleUserRepository } from '../../repositories/accounts/drizzle-user.repository.js';
import { DrizzleCodeRequestRepository } from '../../repositories/authentication/drizzle-code-request.repository.js';
import { DrizzleOneTimeCodeRepository } from '../../repositories/authentication/drizzle-one-time-code.repository.js';

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
