import type { AvatarRefusalReason } from '../../../domain/errors/avatar/avatar-refusal-reason.error.js';
import { AvatarRefusal } from '../../../domain/errors/avatar/avatar-refusal.error.js';

/** Identifies an avatar rule failure at the application boundary. */
export function avatarRefusalOf(
  error: unknown,
): { readonly reason: AvatarRefusalReason; readonly currentVersion: number | undefined } | null {
  return error instanceof AvatarRefusal
    ? { reason: error.reason, currentVersion: error.currentVersion }
    : null;
}
