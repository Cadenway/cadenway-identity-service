import type { SessionClient } from '../../../../models/sessions/session-client.model.js';

/** A continuation receipt and the browser requesting its session. */
export interface FinishFederatedSignInInput {
  // #region Properties
  /** Single-use continuation credential. */
  readonly receipt: string;

  /** Browser requesting the session. */
  readonly client: SessionClient;

  /** Optional device credential used to skip an enrolled second factor. */
  readonly trustedDeviceToken?: string | undefined;
  // #endregion
}
