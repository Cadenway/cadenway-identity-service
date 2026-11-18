import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { ChallengeTokens } from '../../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';
import type { WebAuthn } from '../../../../application/ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { IssueChallengeSecurityKeyOptions } from '../../../../application/use-cases/commands/authentication/issue-challenge-security-key-options/issue-challenge-security-key-options.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { CHALLENGE_TOKENS } from '../../../tokens/two-step/challenge-tokens.token.js';
import { WEB_AUTHN } from '../../../tokens/two-step/web-authn.token.js';

/**
 * Constant issueChallengeSecurityKeyOptionsProvider
 *
 * @description
 * Builds `IssueChallengeSecurityKeyOptions` on the system unit of work of the accounts module.
 *
 * @type {FactoryProvider<IssueChallengeSecurityKeyOptions>}
 */
export const issueChallengeSecurityKeyOptionsProvider: FactoryProvider<IssueChallengeSecurityKeyOptions> =
  {
    provide: IssueChallengeSecurityKeyOptions,
    inject: [UNIT_OF_WORK, CHALLENGE_TOKENS, WEB_AUTHN, CLOCK],
    useFactory: (
      unitOfWork: AccountsUnitOfWork,
      challengeTokens: ChallengeTokens,
      webAuthn: WebAuthn,
      clock: Clock,
    ): IssueChallengeSecurityKeyOptions =>
      new IssueChallengeSecurityKeyOptions(unitOfWork, challengeTokens, webAuthn, clock),
  };
