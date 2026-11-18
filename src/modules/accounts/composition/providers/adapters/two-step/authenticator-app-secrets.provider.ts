import { CONFIG } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import type { AuthenticatorAppSecrets } from '../../../../application/ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import { AesAuthenticatorAppSecrets } from '../../../../infrastructure/adapters/security/aes-authenticator-app-secrets.adapter.js';
import { AUTHENTICATOR_APP_SECRETS } from '../../../tokens/two-step/authenticator-app-secrets.token.js';

/**
 * Constant authenticatorAppSecretsProvider
 *
 * @description
 * Seals the secrets of the authenticator apps with AES-256-GCM under a key derived from
 * `PASSWORD_PEPPER`.
 *
 * @type {FactoryProvider<AuthenticatorAppSecrets>}
 */
export const authenticatorAppSecretsProvider: FactoryProvider<AuthenticatorAppSecrets> = {
  provide: AUTHENTICATOR_APP_SECRETS,
  inject: [CONFIG],
  useFactory: (config: AppConfig): AuthenticatorAppSecrets =>
    new AesAuthenticatorAppSecrets(config.PASSWORD_PEPPER),
};
