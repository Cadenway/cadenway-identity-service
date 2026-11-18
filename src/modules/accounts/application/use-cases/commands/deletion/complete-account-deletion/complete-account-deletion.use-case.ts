import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountApiTokens } from '../../../../ports/outbound/identity/api-tokens/account-api-tokens.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { OwnedOrganizations } from '../../../../ports/outbound/memberships/accounts/owned-organizations.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { CompleteAccountDeletionInput } from './complete-account-deletion.input.js';
import type { CompleteAccountDeletionOutput } from './complete-account-deletion.output.js';

/**
 * Class CompleteAccountDeletion
 *
 * @description
 * Deletes an account at the end of its scheduled deletion (`user.deleted.v1`, decision 9 of P2c),
 * from its durable job. In one system transaction that locks the account:
 *
 * - an account whose deletion was cancelled by a sign-in, is not due yet, or is gone, is left as it
 *   is (`not-due`): the job is idempotent, and a redelivered or doubled job does nothing;
 * - an account that owns an organization in the copy of the memberships at that time (one whose
 *   creation reached the copy after the scheduling) is not deleted: it stays scheduled, its check
 *   is recorded, and the sweep checks it again later (`kept`);
 * - otherwise the account is erased: its row with its profile, preferences, password, codes, reset
 *   links and pending change of address; its sessions with their address and `User-Agent`, and its
 *   last organization choice; its personal API tokens; the throttles and the lockout of its
 *   address. `user.deleted.v1` (actor `system`) is appended with the next version, and
 *   organization-service removes the memberships. The copy of the memberships keeps the ids of the
 *   memberships until those removals reach it.
 */
export class CompleteAccountDeletion {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the deletion.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

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
   * Property apiTokens
   *
   * @description
   * The personal API tokens of the account.
   *
   * @type {AccountApiTokens}
   * @readonly
   */
  private readonly apiTokens: AccountApiTokens;

  /**
   * Property ownedOrganizations
   *
   * @description
   * The organizations the account owns, from the copy of the memberships.
   *
   * @type {OwnedOrganizations}
   * @readonly
   */
  private readonly ownedOrganizations: OwnedOrganizations;

  /**
   * Property clock
   *
   * @description
   * The time of the deletion.
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
   * Takes the ports of the deletion.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction.
   * @param {AccountSessions} sessions - The sessions of the account.
   * @param {AccountApiTokens} apiTokens - The personal API tokens of the account.
   * @param {OwnedOrganizations} ownedOrganizations - The organizations the account owns.
   * @param {Clock} clock - The time of the deletion.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    apiTokens: AccountApiTokens,
    ownedOrganizations: OwnedOrganizations,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.apiTokens = apiTokens;
    this.ownedOrganizations = ownedOrganizations;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Deletes the account when its deletion is due and it owns no organization.
   *
   * @param {CompleteAccountDeletionInput} input - The account.
   * @returns {Promise<CompleteAccountDeletionOutput>} What the job did.
   */
  public async execute(
    input: CompleteAccountDeletionInput,
  ): Promise<CompleteAccountDeletionOutput> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (store: AccountsStore): Promise<CompleteAccountDeletionOutput> => {
        const due: User | null = await store.users.findById(input.userId);
        if (due?.isDeletionDueAt(now) !== true) {
          return { outcome: 'not-due' };
        }
        // The rows of the address before the account, in the order of every sign-in and every
        // request of a code or a link, so a sign-in that cancels the deletion meanwhile waits
        // instead of deadlocking with the job.
        await store.codeRequests.lock(due.email);
        await store.signInAttempts.lock(due.email);
        await store.resetRequests.lock(due.email);
        const user: User | null = await store.users.lock(input.userId);
        if (user?.isDeletionDueAt(now) !== true || !user.email.equals(due.email)) {
          return { outcome: 'not-due' };
        }
        if ((await this.ownedOrganizations.find(user.id)).length > 0) {
          await store.users.markDeletionChecked(user.id, now);
          return { outcome: 'kept' };
        }
        await this.sessions.erase(user.id);
        await this.apiTokens.erase(user.id);
        await store.codeRequests.erase(user.email);
        await store.signInAttempts.erase(user.email);
        await store.resetRequests.erase(user.email);
        await store.users.delete(user);
        await store.events.userDeleted(user.id, user.version + 1);
        return { outcome: 'deleted' };
      },
    );
  }
  // #endregion
}
