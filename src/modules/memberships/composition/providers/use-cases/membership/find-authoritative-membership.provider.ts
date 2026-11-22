import { CONFIG, InternalTokenSigner, ProblemException } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import { FindAuthoritativeMembership } from '../../../../application/use-cases/queries/membership/find-authoritative-membership/find-authoritative-membership.use-case.js';
import { OrganizationMembershipAuthority } from '../../../../infrastructure/adapters/organization/organization-membership-authority.adapter.js';

/** Requires a current proof for scoped decisions even when local authority settings are absent. */
export const findAuthoritativeMembershipProvider: FactoryProvider<FindAuthoritativeMembership> = {
  provide: FindAuthoritativeMembership,
  inject: [CONFIG],
  useFactory: async (config: AppConfig): Promise<FindAuthoritativeMembership> => {
    const url = config.ORGANIZATION_SERVICE_URL;
    const privateJwk = config.IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK;
    if (url === undefined && privateJwk === undefined) {
      return new FindAuthoritativeMembership({
        find: () =>
          Promise.reject(new ProblemException({ status: 503, code: 'organization.unavailable' })),
      });
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
