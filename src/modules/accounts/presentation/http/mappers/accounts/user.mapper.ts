import type { User } from '@cadenway/contracts/types/internal/identity-service';

import type { AccountView } from '../../../../application/projections/accounts/account-view.projection.js';

/**
 * Function toUser
 *
 * @description
 * Maps an account to `User` of the contract, `displayName`, `jobTitle` and `timeZone` always sent
 * from this version on.
 *
 * @param {AccountView} view - The account.
 * @returns {User} The body of the account.
 */
export function toUser(view: AccountView): User {
  return {
    id: view.id,
    name: view.name,
    email: view.email,
    language: view.language,
    displayName: view.displayName,
    jobTitle: view.jobTitle,
    timeZone: view.timeZone,
    passwordChangedAt: view.passwordChangedAt.toISOString(),
    version: view.version,
  };
}
