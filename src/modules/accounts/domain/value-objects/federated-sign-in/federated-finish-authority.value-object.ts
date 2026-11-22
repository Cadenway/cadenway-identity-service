import type { LinkedFederatedAccount } from './linked-federated-account.value-object.js';

/** Authority read for this account and method when consuming the receipt, under the same locks. */
export interface FederatedFinishAuthority {
  // #region Properties
  /** The current account behind the selected link, when it still exists. */
  readonly account: { readonly id: string; readonly enabled: boolean } | null;
  readonly link: LinkedFederatedAccount | null;
  readonly activeMembership: {
    readonly organizationId: string;
    readonly userId: string;
    readonly memberId: string;
  } | null;
  readonly maySignIn: boolean;
  readonly twoStep: 'not-required' | 'challenge-required' | 'trusted-device';
  // #endregion
}
