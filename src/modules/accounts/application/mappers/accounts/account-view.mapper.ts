import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { AccountView } from '../../projections/accounts/account-view.projection.js';

/**
 * Function toAccountView
 *
 * @description
 * Maps an account to its view.
 *
 * @param {User} user - The account.
 * @returns {AccountView} Its view.
 */
export function toAccountView(user: User): AccountView {
  return {
    id: user.id,
    name: user.name,
    email: user.email.value,
    language: user.language,
    displayName: user.displayName,
    jobTitle: user.jobTitle,
    timeZone: user.timeZone,
    version: user.version,
  };
}
