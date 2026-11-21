import type { SystemTransactionRunner } from '@cadenway/nest-common/database';

import type { AccountsUnitOfWork } from '../../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { FederatedFinishStore } from '../../../../../application/ports/outbound/transactions/federation/federated-finish-store.port.js';
import type { FederatedFinishUnitOfWork } from '../../../../../application/ports/outbound/transactions/federation/federated-finish-unit-of-work.port.js';
import { DrizzleFederatedAccountLinkRepository } from '../../repositories/federated-sign-in/drizzle-federated-account-link.repository.js';
import { DrizzleFederatedSignInFlowRepository } from '../../repositories/federated-sign-in/drizzle-federated-sign-in-flow.repository.js';

/** Redeems a receipt in the same write transaction as ordinary account sign-in. */
export class SystemFederatedFinishUnitOfWork implements FederatedFinishUnitOfWork {
  // #region Constructor
  /** Extends the ordinary account transaction with the locked federation records and authority. */
  public constructor(
    private readonly runner: SystemTransactionRunner,
    private readonly accounts: AccountsUnitOfWork,
    private readonly authority: Pick<FederatedFinishStore, 'isAllowed' | 'hasActiveMembership'>,
  ) {}
  // #endregion

  // #region Methods
  /** Joins the account transaction to read and update the receipt with its sign-in outcome. */
  public run<TResult>(work: (store: FederatedFinishStore) => Promise<TResult>): Promise<TResult> {
    return this.accounts.run((store) =>
      this.runner.run((scope) => {
        const flows = new DrizzleFederatedSignInFlowRepository(scope);
        const links = new DrizzleFederatedAccountLinkRepository(scope);
        return work({
          ...store,
          findByReceiptHash: (hash) => flows.findByReceiptHash(hash),
          save: (flow, version) => flows.save(flow, version),
          findLink: (identity) => links.findByIdentity(identity),
          isAllowed: (userId, connection) => this.authority.isAllowed(userId, connection),
          hasActiveMembership: (userId, organizationId) =>
            this.authority.hasActiveMembership(userId, organizationId),
        });
      }),
    );
  }
  // #endregion
}
