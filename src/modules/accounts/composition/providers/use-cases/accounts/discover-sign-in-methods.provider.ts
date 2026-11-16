import type { FactoryProvider } from '@nestjs/common';

import { DiscoverSignInMethods } from '../../../../application/use-cases/queries/authentication/discover-sign-in-methods/discover-sign-in-methods.use-case.js';

/**
 * Constant discoverSignInMethodsProvider
 *
 * @description
 * Builds DiscoverSignInMethods with the dependencies configured by the Accounts module.
 *
 * @type {FactoryProvider<DiscoverSignInMethods>}
 */
export const discoverSignInMethodsProvider: FactoryProvider<DiscoverSignInMethods> = {
  provide: DiscoverSignInMethods,
  useFactory: (): DiscoverSignInMethods => new DiscoverSignInMethods(),
};
