import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountApiTokens } from '../../../../ports/outbound/identity/api-tokens/account-api-tokens.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { AccountDeletionAuthority } from '../../../../ports/outbound/memberships/accounts/account-deletion-authority.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { CompleteAccountDeletionInput } from './complete-account-deletion.input.js';
import type { CompleteAccountDeletionOutput } from './complete-account-deletion.output.js';

/** Completes an account deletion only after Organization confirms the durable attempt. */
export class CompleteAccountDeletion {
  // #region Constructor
  /** Binds the authority, account transactions and dependent account state. */
  public constructor(
    private readonly unitOfWork: AccountsUnitOfWork,
    private readonly sessions: AccountSessions,
    private readonly apiTokens: AccountApiTokens,
    private readonly authority: AccountDeletionAuthority,
    private readonly clock: Clock,
  ) {}
  // #endregion

  // #region Methods
  /** Claims a due account, reserves it outside SQL, then deletes and publishes atomically. */
  public async execute(
    input: CompleteAccountDeletionInput,
  ): Promise<CompleteAccountDeletionOutput> {
    const { userId } = input;
    const now = this.clock.now();
    const attemptId = await this.unitOfWork.run(async (store) => {
      const user = await store.users.lock(userId);
      if (user?.isDeletionDueAt(now) !== true) return null;
      return (await store.users.findDeletionAttempt(userId)) ?? store.users.claimDeletion(userId);
    });
    if (attemptId === null) return { outcome: 'not-due' };

    // A lost response must keep the local claim. The worker retries the same attempt ID.
    if ((await this.authority.reserve(userId, attemptId)) === 'owner') {
      await this.unitOfWork.run((store) => store.users.keepDeletion(userId, attemptId, now));
      return { outcome: 'kept' };
    }

    return this.unitOfWork.run(async (store): Promise<CompleteAccountDeletionOutput> => {
      const due: User | null = await store.users.findById(userId);
      if (due?.isDeletionDueAt(now) !== true) return { outcome: 'not-due' };
      // Keep the address-before-account lock order used by sign-in and code/link requests.
      await store.codeRequests.lock(due.email);
      await store.signInAttempts.lock(due.email);
      await store.resetRequests.lock(due.email);
      const user: User | null = await store.users.lock(userId);
      if (
        user?.isDeletionDueAt(now) !== true ||
        !user.email.equals(due.email) ||
        (await store.users.findDeletionAttempt(userId)) !== attemptId
      ) {
        return { outcome: 'not-due' };
      }
      await this.sessions.erase(user.id);
      await this.apiTokens.erase(user.id);
      await store.codeRequests.erase(user.email);
      await store.signInAttempts.erase(user.email);
      await store.resetRequests.erase(user.email);
      await store.users.delete(user, attemptId);
      await store.events.userDeleted(user.id, user.version + 1);
      return { outcome: 'deleted' };
    });
  }
  // #endregion
}
