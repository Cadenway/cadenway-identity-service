import { PasswordResetLink } from '../../../../../domain/aggregates/password-reset/password-reset-link.aggregate.js';
import type passwordResetLinks from '../../schemas/password-reset/password-reset-link.schema.js';

/**
 * Type PasswordResetLinkRow
 *
 * @description
 * A row of `password_reset_links`.
 *
 * @type {typeof passwordResetLinks.$inferSelect}
 */
export type PasswordResetLinkRow = typeof passwordResetLinks.$inferSelect;

/**
 * Function toPasswordResetLink
 *
 * @description
 * Rebuilds a link from its row.
 *
 * @param {PasswordResetLinkRow} row - The row.
 * @returns {PasswordResetLink} The link.
 */
export function toPasswordResetLink(row: PasswordResetLinkRow): PasswordResetLink {
  return PasswordResetLink.restore({
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    replacedAt: row.replacedAt,
  });
}
