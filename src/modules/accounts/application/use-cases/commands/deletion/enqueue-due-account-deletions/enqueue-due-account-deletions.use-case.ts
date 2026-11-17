import type { DueAccountDeletion } from '../../../../models/deletion/due-account-deletion.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { EnqueueDueAccountDeletionsOutput } from './enqueue-due-account-deletions.output.js';

/**
 * Class EnqueueDueAccountDeletions
 *
 * @description
 * The sweep of the scheduled deletions (`cw-jobs`: the business table is the source of truth, a
 * recurring job claims the due rows and enqueues one job per row). In one system transaction it
 * claims the accounts whose `deleteAt` has passed, with `for update skip locked`, and enqueues for
 * each a job of `CompleteAccountDeletion` whose occurrence is the instant the deletion became due,
 * or its last check that kept it: a missed or doubled sweep changes nothing, and an account kept
 * because it owned an organization is checked again once `RECHECK_DELAY_MS` passed.
 */
export class EnqueueDueAccountDeletions {
  // #region Properties
  /**
   * Property RECHECK_DELAY_MS
   *
   * @description
   * Delay before an account kept at `deleteAt`, because it owned an organization then, is checked
   * again: one hour. The contract keeps it scheduled "until it no longer owns one or signs in".
   *
   * @type {number}
   * @readonly
   */
  public static readonly RECHECK_DELAY_MS: number = 60 * 60_000;

  /**
   * Property BATCH_SIZE
   *
   * @description
   * Accounts one sweep claims at most; the next sweep takes the rest.
   *
   * @type {number}
   * @readonly
   */
  public static readonly BATCH_SIZE: number = 100;

  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the sweep.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property clock
   *
   * @description
   * The time of the sweep.
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
   * Takes the ports of the sweep.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction.
   * @param {Clock} clock - The time of the sweep.
   * @constructor
   */
  public constructor(unitOfWork: AccountsUnitOfWork, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Enqueues the due deletions.
   *
   * @returns {Promise<EnqueueDueAccountDeletionsOutput>} The claimed accounts and the enqueued jobs.
   */
  public async execute(): Promise<EnqueueDueAccountDeletionsOutput> {
    const now: Date = this.clock.now();
    const checkedBefore: Date = new Date(
      now.getTime() - EnqueueDueAccountDeletions.RECHECK_DELAY_MS,
    );
    return this.unitOfWork.run(
      async (store: AccountsStore): Promise<EnqueueDueAccountDeletionsOutput> => {
        const due: DueAccountDeletion[] = await store.users.findDueDeletions(
          now,
          checkedBefore,
          EnqueueDueAccountDeletions.BATCH_SIZE,
        );
        let enqueued: number = 0;
        for (const deletion of due) {
          if (await store.deletionQueue.enqueue(deletion.userId, deletion.dueSince.toISOString())) {
            enqueued += 1;
          }
        }
        return { claimed: due.length, enqueued };
      },
    );
  }
  // #endregion
}
