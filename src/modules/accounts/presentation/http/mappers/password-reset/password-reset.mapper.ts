import type {
  PasswordResetCompleted,
  PasswordResetLink,
} from '@cadenway/contracts/types/internal/identity-service';

import type { ConfirmPasswordResetOutput } from '../../../../application/use-cases/commands/password-reset/confirm-password-reset/confirm-password-reset.output.js';
import type { InspectPasswordResetLinkOutput } from '../../../../application/use-cases/queries/password-reset/inspect-password-reset-link/inspect-password-reset-link.output.js';

/**
 * Function toPasswordResetLink
 *
 * @description
 * The account of a usable reset link, in the shape of the contract.
 *
 * @param {InspectPasswordResetLinkOutput} output - The account, the expiry and the sessions.
 * @returns {PasswordResetLink} The response body.
 */
export function toPasswordResetLink(output: InspectPasswordResetLinkOutput): PasswordResetLink {
  return {
    email: output.email,
    expiresAt: output.expiresAt.toISOString(),
    sessionCount: output.sessionCount,
  };
}

/**
 * Function toPasswordResetCompleted
 *
 * @description
 * The outcome of a reset, in the shape of the contract.
 *
 * @param {ConfirmPasswordResetOutput} output - The address and the closed sessions.
 * @returns {PasswordResetCompleted} The response body.
 */
export function toPasswordResetCompleted(
  output: ConfirmPasswordResetOutput,
): PasswordResetCompleted {
  return { email: output.email, closedSessionCount: output.closedSessionCount };
}
