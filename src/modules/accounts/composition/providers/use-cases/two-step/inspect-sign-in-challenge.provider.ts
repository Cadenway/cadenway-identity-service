import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { ChallengeTokens } from '../../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { InspectSignInChallenge } from '../../../../application/use-cases/queries/authentication/inspect-sign-in-challenge/inspect-sign-in-challenge.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { CHALLENGE_TOKENS } from '../../../tokens/two-step/challenge-tokens.token.js';

/**
 * Constant inspectSignInChallengeProvider
 *
 * @description
 * Builds `InspectSignInChallenge` on the system unit of work of the accounts module.
 *
 * @type {FactoryProvider<InspectSignInChallenge>}
 */
export const inspectSignInChallengeProvider: FactoryProvider<InspectSignInChallenge> = {
  provide: InspectSignInChallenge,
  inject: [UNIT_OF_WORK, CHALLENGE_TOKENS, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    challengeTokens: ChallengeTokens,
    clock: Clock,
  ): InspectSignInChallenge => new InspectSignInChallenge(unitOfWork, challengeTokens, clock),
};
