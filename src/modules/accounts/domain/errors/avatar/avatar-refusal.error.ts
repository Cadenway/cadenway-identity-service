import { DomainError } from '../accounts/domain.error.js';
import type { AvatarRefusalReason } from './avatar-refusal-reason.error.js';

/** Refuses an avatar operation without including identifiers or transfer values in the error. */
export class AvatarRefusal extends DomainError {
  // #region Constructor
  /** Keeps a reason the application can map to the installed contract. */
  public constructor(
    public readonly reason: AvatarRefusalReason,
    public readonly currentVersion?: number,
  ) {
    super(`Avatar operation refused: ${reason}.`);
  }
  // #endregion
}
