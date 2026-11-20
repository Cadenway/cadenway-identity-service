import { DomainError } from '../session/domain.error.js';

/** A restored ticket whose digest, version or timestamps violate a storage invariant. */
export class InvalidRealtimeTicketStateError extends DomainError {
  // #region Constructor
  /** Describes corrupt state without including credential material. */
  public constructor() {
    super('The stored realtime ticket violates an invariant.');
  }
  // #endregion
}
