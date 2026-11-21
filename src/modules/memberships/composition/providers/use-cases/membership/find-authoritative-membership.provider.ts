import { CONFIG, InternalTokenSigner } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import { FindAuthoritativeMembership } from '../../../../application/use-cases/queries/membership/find-authoritative-membership/find-authoritative-membership.use-case.js';
import { OrganizationMembershipAuthority } from '../../../../infrastructure/adapters/organization/organization-membership-authority.adapter.js';

/** Enables current membership checks when both Organization settings are configured. */
export const findAuthoritativeMembershipProvider: FactoryProvider<FindAuthoritativeMembership | null> =
  {
    provide: FindAuthoritativeMembership,
    inject: [CONFIG],
    useFactory: async (config: AppConfig): Promise<FindAuthoritativeMembership | null> => {
      const url = config.ORGANIZATION_SERVICE_URL;
      const privateJwk = config.IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK;
      if (url === undefined && privateJwk === undefined) {
        return null;
      }
      if (url === undefined || privateJwk === undefined) {
        throw new Error(
          'Organization membership authority requires both its URL and its signing key.',
        );
      }
      const signer = await InternalTokenSigner.create({ issuer: 'identity-service', privateJwk });
      return new FindAuthoritativeMembership(new OrganizationMembershipAuthority(url, signer));
    },
  };
