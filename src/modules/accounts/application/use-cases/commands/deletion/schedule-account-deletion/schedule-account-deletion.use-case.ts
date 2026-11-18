import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { SessionAuthentication } from '../../../../models/sessions/session-authentication.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountApiTokens } from '../../../../ports/outbound/identity/api-tokens/account-api-tokens.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { OwnedOrganizations } from '../../../../ports/outbound/memberships/accounts/owned-organizations.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { dropPendingEmailChange } from '../../../../services/email-change/pending-email-change.service.js';
import type { ScheduleAccountDeletionInput } from './schedule-account-deletion.input.js';
import type { ScheduleAccountDeletionOutput } from './schedule-account-deletion.output.js';
import type { TrustedDevices } from '../../../../ports/outbound/identity/sessions/trusted-devices.port.js';
import { reauthenticationRequired } from '../../../../services/two-step/recent-authentication.service.js';

/**
 * Class ScheduleAccountDeletion
 *
 * @description
 * Schedules the deletion of the account of the actor in 30 days
 * (`POST /internal/v1/users/{userId}/deletion`, decision 9 of P2c). The checks run in this order,
 * each refusal leaving nothing written:
 *
 * 1. The account of the path is the actor (`user.not-found`) and the session is an open session of
 *    the actor (`session.not-found`).
 * 2. The actor owns no organization in the copy of the memberships
 *    (`account.organization-owner`, with the organizations); it never calls organization-service.
 * 3. The recent authentication of the session (`auth.reauthentication-required`, decision 4), a
 *    second factor for an account with two-step verification.
 *
 * Then, in the same transaction: the account takes its `deleteAt` with the next version, every
 * session of the account (the one of the request included) and every personal API token are
 * revoked, a pending change of address is dropped, every trusted device is forgotten (the two-step
 * verification stays), and `user.deletion-scheduled.v1` is appended. A
 * sign-in before the deletion cancels it; the durable job of `CompleteAccountDeletion` deletes the
 * account at `deleteAt`.
 */
export class ScheduleAccountDeletion {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the scheduling.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

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
   * Property apiTokens
   *
   * @description
   * The personal API tokens of the person.
   *
   * @type {AccountApiTokens}
   * @readonly
   */
  private readonly apiTokens: AccountApiTokens;

  /**
   * Property ownedOrganizations
   *
   * @description
   * The organizations the person owns, from the copy of the memberships.
   *
   * @type {OwnedOrganizations}
   * @readonly
   */
  private readonly ownedOrganizations: OwnedOrganizations;

  /**
   * Property clock
   *
   * @description
   * The time of the scheduling.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;

  /**
   * Property trustedDevices
   *
   * @description
   * The trusted devices of the account, forgotten by the scheduling.
   *
   * @type {TrustedDevices}
   * @readonly
   */
  private readonly trustedDevices: TrustedDevices;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the ports of the scheduling.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction.
   * @param {AccountSessions} sessions - The sessions of the person.
   * @param {AccountApiTokens} apiTokens - The personal API tokens of the person.
   * @param {OwnedOrganizations} ownedOrganizations - The organizations the person owns.
   * @param {Clock} clock - The time of the scheduling.
   * @param {TrustedDevices} trustedDevices - The trusted devices of the account, forgotten by the scheduling.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    apiTokens: AccountApiTokens,
    ownedOrganizations: OwnedOrganizations,
    clock: Clock,
    trustedDevices: TrustedDevices,
  ) {
    this.unitOfWork = unitOfWork;
    this.sessions = sessions;
    this.apiTokens = apiTokens;
    this.ownedOrganizations = ownedOrganizations;
    this.clock = clock;
    this.trustedDevices = trustedDevices;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Schedules the deletion.
   *
   * @param {ScheduleAccountDeletionInput} input - The person and the session.
   * @returns {Promise<ScheduleAccountDeletionOutput>} When the deletion takes effect.
   * @throws {AccountRefusal} `user.not-found`, `session.not-found`, `account.organization-owner`
   * or `auth.reauthentication-required`.
   */
  public async execute(
    input: ScheduleAccountDeletionInput,
  ): Promise<ScheduleAccountDeletionOutput> {
    if (input.actorUserId !== input.userId) {
      throw new AccountRefusal({ reason: 'user-not-found' });
    }
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (store: AccountsStore): Promise<ScheduleAccountDeletionOutput> => {
        const user: User | null = await store.users.lock(input.userId);
        if (user === null) {
          throw new AccountRefusal({ reason: 'user-not-found' });
        }
        const authentication: SessionAuthentication = await this.sessions.check(
          input.userId,
          input.sessionId,
        );
        if (authentication === 'not-found') {
          throw new AccountRefusal({ reason: 'session-not-found' });
        }
        const owned: readonly string[] = await this.ownedOrganizations.find(user.id);
        if (owned.length > 0) {
          throw new AccountRefusal({ reason: 'organization-owner', organizationIds: owned });
        }
        if (authentication === 'stale') {
          throw new AccountRefusal(await reauthenticationRequired(store, user.id));
        }
        const scheduled: User = user.scheduleDeletion(now);
        await store.users.update(scheduled);
        await this.sessions.revokeAll(user.id, null);
        await this.apiTokens.revokeAll(user.id);
        await dropPendingEmailChange(store, user.id, now);
        await this.trustedDevices.forget(user.id);
        await store.events.userDeletionScheduled(scheduled);
        return { deleteAt: scheduled.deleteAt ?? now };
      },
    );
  }
  // #endregion
}
