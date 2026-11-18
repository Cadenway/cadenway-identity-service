import type { ClassProvider } from '@nestjs/common';

import type { ChallengeTokens } from '../../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';
import { RandomChallengeTokens } from '../../../../infrastructure/adapters/security/random-challenge-tokens.adapter.js';
import { CHALLENGE_TOKENS } from '../../../tokens/two-step/challenge-tokens.token.js';

/**
 * Constant challengeTokensProvider
 *
 * @description
 * Issues random tokens of 256 bits for the two-step challenges, stored as SHA-256 hashes.
 *
 * @type {ClassProvider<ChallengeTokens>}
 */
export const challengeTokensProvider: ClassProvider<ChallengeTokens> = {
  provide: CHALLENGE_TOKENS,
  useClass: RandomChallengeTokens,
};
