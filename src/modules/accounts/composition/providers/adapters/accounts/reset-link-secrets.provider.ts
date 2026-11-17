import type { FactoryProvider } from '@nestjs/common';

import type { ResetLinkSecrets } from '../../../../application/ports/outbound/security/password-reset/reset-link-secrets.port.js';
import { RandomResetLinkSecrets } from '../../../../infrastructure/adapters/security/random-reset-link-secrets.adapter.js';
import { RESET_LINK_SECRETS } from '../../../tokens/accounts/reset-link-secrets.token.js';

/**
 * Constant resetLinkSecretsProvider
 *
 * @description
 * Binds the secrets of the password reset links to `node:crypto`.
 *
 * @type {FactoryProvider<ResetLinkSecrets>}
 */
export const resetLinkSecretsProvider: FactoryProvider<ResetLinkSecrets> = {
  provide: RESET_LINK_SECRETS,
  useFactory: (): ResetLinkSecrets => new RandomResetLinkSecrets(),
};
