import { CONFIG } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import type { PasswordHasher } from '../../../../application/ports/outbound/security/authentication/password-hasher.port.js';
import { Argon2PasswordHasher } from '../../../../infrastructure/adapters/security/argon2-password-hasher.adapter.js';
import { PASSWORD_HASHER } from '../../../tokens/accounts/password-hasher.token.js';

/**
 * Constant passwordHasherProvider
 *
 * @description
 * Binds the PasswordHasher port to the Accounts adapter used at runtime.
 *
 * @type {FactoryProvider<PasswordHasher>}
 */
export const passwordHasherProvider: FactoryProvider<PasswordHasher> = {
  provide: PASSWORD_HASHER,
  inject: [CONFIG],
  useFactory: (config: AppConfig): PasswordHasher =>
    new Argon2PasswordHasher(config.PASSWORD_PEPPER),
};
