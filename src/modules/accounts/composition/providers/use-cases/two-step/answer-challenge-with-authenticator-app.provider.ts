import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../application/ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import type { AuthenticatorAppSecrets } from '../../../../application/ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import type { ChallengeTokens } from '../../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';
import type { Totp } from '../../../../application/ports/outbound/security/two-step/totp.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { AnswerChallengeWithAuthenticatorApp } from '../../../../application/use-cases/commands/authentication/answer-challenge-with-authenticator-app/answer-challenge-with-authenticator-app.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { SESSION_OPENER } from '../../../tokens/accounts/session-opener.token.js';
import { AUTHENTICATOR_APP_SECRETS } from '../../../tokens/two-step/authenticator-app-secrets.token.js';
import { CHALLENGE_TOKENS } from '../../../tokens/two-step/challenge-tokens.token.js';
import { TOTP } from '../../../tokens/two-step/totp.token.js';
import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';

/**
 * Constant answerChallengeWithAuthenticatorAppProvider
 *
 * @description
 * Builds `AnswerChallengeWithAuthenticatorApp` on the system unit of work of the accounts module, which the session it opens joins.
 *
 * @type {FactoryProvider<AnswerChallengeWithAuthenticatorApp>}
 */
export const answerChallengeWithAuthenticatorAppProvider: FactoryProvider<AnswerChallengeWithAuthenticatorApp> =
  {
    provide: AnswerChallengeWithAuthenticatorApp,
    inject: [
      UNIT_OF_WORK,
      CHALLENGE_TOKENS,
      AUTHENTICATOR_APP_SECRETS,
      TOTP,
      SESSION_OPENER,
      DEVICE_READER,
      TRUSTED_DEVICES,
      CLOCK,
    ],
    useFactory: (
      unitOfWork: AccountsUnitOfWork,
      challengeTokens: ChallengeTokens,
      appSecrets: AuthenticatorAppSecrets,
      totp: Totp,
      sessions: SessionOpener,
      devices: DeviceReader,
      trustedDevices: TrustedDevices,
      clock: Clock,
    ): AnswerChallengeWithAuthenticatorApp =>
      new AnswerChallengeWithAuthenticatorApp(
        unitOfWork,
        challengeTokens,
        appSecrets,
        totp,
        sessions,
        devices,
        trustedDevices,
        clock,
      ),
  };
