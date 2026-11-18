import type { FactoryProvider } from '@nestjs/common';

import { EraseUserApiTokens } from '../../../../../api-tokens/public/api-token/erase-user-api-tokens.js';
import { RevokeUserApiTokens } from '../../../../../api-tokens/public/api-token/revoke-user-api-tokens.js';
import type { RevokeUserApiTokensOutput } from '../../../../../api-tokens/public/api-token/revoke-user-api-tokens.js';
import type { AccountApiTokens } from '../../../../application/ports/outbound/identity/api-tokens/account-api-tokens.port.js';
import { ACCOUNT_API_TOKENS } from '../../../tokens/accounts/account-api-tokens.token.js';

/**
 * Constant accountApiTokensProvider
 *
 * @description
 * Binds the `AccountApiTokens` port of the accounts module to the operations the api-tokens module
 * exports for the deletion of an account; both join the system transaction of the caller.
 *
 * @type {FactoryProvider<AccountApiTokens>}
 */
export const accountApiTokensProvider: FactoryProvider<AccountApiTokens> = {
  provide: ACCOUNT_API_TOKENS,
  inject: [RevokeUserApiTokens, EraseUserApiTokens],
  useFactory: (
    revokeUserApiTokens: RevokeUserApiTokens,
    eraseUserApiTokens: EraseUserApiTokens,
  ): AccountApiTokens => ({
    revokeAll: async (userId: string): Promise<number> => {
      const revoked: RevokeUserApiTokensOutput = await revokeUserApiTokens.execute({ userId });
      return revoked.revokedCount;
    },
    erase: (userId: string): Promise<void> => eraseUserApiTokens.execute({ userId }),
  }),
};
