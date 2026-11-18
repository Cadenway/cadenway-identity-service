import type { FactoryProvider } from '@nestjs/common';

import { FindOwnedOrganizations } from '../../../../../memberships/public/membership/find-owned-organizations.js';
import type { FindOwnedOrganizationsOutput } from '../../../../../memberships/public/membership/find-owned-organizations.js';
import type { OwnedOrganizations } from '../../../../application/ports/outbound/memberships/accounts/owned-organizations.port.js';
import { OWNED_ORGANIZATIONS } from '../../../tokens/accounts/owned-organizations.token.js';

/**
 * Constant ownedOrganizationsProvider
 *
 * @description
 * Binds the `OwnedOrganizations` port of the accounts module to the reading of the copy of the
 * memberships, which joins the system transaction of the caller.
 *
 * @type {FactoryProvider<OwnedOrganizations>}
 */
export const ownedOrganizationsProvider: FactoryProvider<OwnedOrganizations> = {
  provide: OWNED_ORGANIZATIONS,
  inject: [FindOwnedOrganizations],
  useFactory: (findOwnedOrganizations: FindOwnedOrganizations): OwnedOrganizations => ({
    find: async (userId: string): Promise<readonly string[]> => {
      const owned: FindOwnedOrganizationsOutput = await findOwnedOrganizations.execute({ userId });
      return owned.organizationIds;
    },
  }),
};
