import { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import { EmailAddress } from '../../../../../domain/value-objects/email/email-address.value-object.js';
import type users from '../../schemas/accounts/user.schema.js';

/**
 * Type UserRow
 *
 * @description
 * A row of `users`.
 *
 * @type {typeof users.$inferSelect}
 */
export type UserRow = typeof users.$inferSelect;

/**
 * Function toUser
 *
 * @description
 * Maps a row to the account it stores.
 *
 * @param {UserRow} row - The row.
 * @returns {User} The account.
 */
export function toUser(row: UserRow): User {
  return User.restore({
    id: row.id,
    email: EmailAddress.of(row.email),
    name: row.name,
    language: row.language,
    emailVerifiedAt: row.emailVerifiedAt,
    version: row.version,
    signUpCount: row.signUpCount,
  });
}
