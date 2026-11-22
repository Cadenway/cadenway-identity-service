import { DomainError } from '../accounts/domain.error.js';

/** Refuses an unusable credential or an invalid flow without revealing state or account details. */
export class FederatedSignInRefusedError extends DomainError {
  // #region Constructor
  /** Uses the same refusal for all unusable flows and receipts. */
  public constructor() {
    super('Federated sign-in cannot continue.');
  }
  // #endregion
}
