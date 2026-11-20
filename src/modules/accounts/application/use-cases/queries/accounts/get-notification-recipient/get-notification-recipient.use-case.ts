import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { AccountView } from '../../../../projections/accounts/account-view.projection.js';

/** Reads the active account profile used by a notification delivery job. */
export class GetNotificationRecipient {
  // #region Constructor
  /** Takes the system transaction used by owner-scoped account reads. */
  public constructor(private readonly work: AccountsUnitOfWork) {}
  // #endregion

  // #region Methods
  /** Reads eligibility and all delivery fields from the same account row. */
  public execute(
    userId: string,
  ): Promise<Pick<AccountView, 'email' | 'language' | 'timeZone' | 'version'> | null> {
    return this.work.run(
      async ({ users }) => {
        const account = await users.findById(userId);
        if (account === null || !account.isVerified || account.deleteAt !== null) return null;
        return {
          email: account.email.value,
          language: account.language,
          timeZone: account.timeZone,
          version: account.version,
        };
      },
      { readOnly: true },
    );
  }
  // #endregion
}
