import { CONFIG, InternalTokenSigner } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import type { AccountDeletionAuthority } from '../../../../application/ports/outbound/memberships/accounts/account-deletion-authority.port.js';
import { OrganizationDeletionAuthority } from '../../../../infrastructure/adapters/organization/organization-deletion-authority.adapter.js';
import { ACCOUNT_DELETION_AUTHORITY } from '../../../tokens/accounts/account-deletion-authority.token.js';

/** Binds the Organization endpoint used by the deletion worker. */
export const accountDeletionAuthorityProvider: FactoryProvider<AccountDeletionAuthority> = {
  provide: ACCOUNT_DELETION_AUTHORITY,
  inject: [CONFIG],
  useFactory: async (config: AppConfig): Promise<AccountDeletionAuthority> => {
    const url = config.ORGANIZATION_SERVICE_URL;
    const privateJwk = config.IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK;
    if (url === undefined || privateJwk === undefined) {
      return {
        reserve: () => Promise.reject(new Error('Organization deletion authority unavailable.')),
      };
    }
    const signer = await InternalTokenSigner.create({ issuer: 'identity-service', privateJwk });
    return new OrganizationDeletionAuthority(url, signer);
  },
};
