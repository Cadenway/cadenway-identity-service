import { CONFIG } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import type { OneTimeCodeSecrets } from '../../../../application/ports/outbound/security/authentication/one-time-code-secrets.port.js';
import { HmacOneTimeCodeSecrets } from '../../../../infrastructure/adapters/security/hmac-one-time-code-secrets.adapter.js';
import { CODE_SECRETS } from '../../../tokens/accounts/one-time-code-secrets.token.js';

/**
 * Constant oneTimeCodeSecretsProvider
 *
 * @description
 * Binds the OneTimeCodeSecrets port to the Accounts adapter used at runtime.
 *
 * @type {FactoryProvider<OneTimeCodeSecrets>}
 */
export const oneTimeCodeSecretsProvider: FactoryProvider<OneTimeCodeSecrets> = {
  provide: CODE_SECRETS,
  inject: [CONFIG],
  useFactory: (config: AppConfig): OneTimeCodeSecrets =>
    new HmacOneTimeCodeSecrets(config.PASSWORD_PEPPER),
};
