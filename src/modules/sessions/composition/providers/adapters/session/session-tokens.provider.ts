import type { FactoryProvider } from '@nestjs/common';
import { RandomSessionTokens } from '../../../../infrastructure/adapters/crypto/random-session-tokens.adapter.js';
import type { SessionTokens } from '../../../../application/ports/outbound/security/session/session-tokens.port.js';
import { SESSION_TOKENS } from '../../../tokens/session/session-tokens.token.js';

/**
 * Constant sessionTokensProvider
 *
 * @description
 * Issues and hashes opaque session tokens at the cryptographic boundary.
 *
 * @type {FactoryProvider<SessionTokens>}
 */
export const sessionTokensProvider: FactoryProvider<SessionTokens> = {
  provide: SESSION_TOKENS,
  useFactory: (): SessionTokens => new RandomSessionTokens(),
};
