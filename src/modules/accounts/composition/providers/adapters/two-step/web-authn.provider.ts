import { CONFIG } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import type { WebAuthn } from '../../../../application/ports/outbound/security/two-step/web-authn.port.js';
import { SimpleWebAuthn } from '../../../../infrastructure/adapters/security/simple-web-authn.adapter.js';
import { WEB_AUTHN } from '../../../tokens/two-step/web-authn.token.js';

/**
 * Constant webAuthnProvider
 *
 * @description
 * The WebAuthn relying party of `WEBAUTHN_RP_ID`, accepting the exact origins of
 * `WEBAUTHN_ORIGINS`.
 *
 * @type {FactoryProvider<WebAuthn>}
 */
export const webAuthnProvider: FactoryProvider<WebAuthn> = {
  provide: WEB_AUTHN,
  inject: [CONFIG],
  useFactory: (config: AppConfig): WebAuthn =>
    new SimpleWebAuthn(config.WEBAUTHN_RP_ID, config.WEBAUTHN_ORIGINS),
};
