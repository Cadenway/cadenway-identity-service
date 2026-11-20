import { DomainError } from '../session/domain.error.js';

/** A ticket cannot be issued or redeemed with the current session or membership. */
export class RealtimeTicketUnusableError extends DomainError {
  // #region Constructor
  /** Collapses ticket refusal reasons without including credential material. */
  public constructor() {
    super('The realtime ticket is not usable.');
  }
  // #endregion
}
