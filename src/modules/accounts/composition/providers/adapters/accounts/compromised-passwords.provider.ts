import type { FactoryProvider } from '@nestjs/common';

import type { CompromisedPasswords } from '../../../../application/ports/outbound/security/authentication/compromised-passwords.port.js';
import { EmbeddedCompromisedPasswords } from '../../../../infrastructure/adapters/security/embedded-compromised-passwords.adapter.js';
import { COMPROMISED_PASSWORDS } from '../../../tokens/accounts/compromised-passwords.token.js';

/**
 * Constant compromisedPasswordsProvider
 *
 * @description
 * Binds the CompromisedPasswords port to the Accounts adapter used at runtime.
 *
 * @type {FactoryProvider<CompromisedPasswords>}
 */
export const compromisedPasswordsProvider: FactoryProvider<CompromisedPasswords> = {
  provide: COMPROMISED_PASSWORDS,
  useFactory: (): CompromisedPasswords => new EmbeddedCompromisedPasswords(),
};
