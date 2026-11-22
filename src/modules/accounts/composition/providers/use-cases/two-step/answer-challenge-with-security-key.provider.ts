import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { FederatedMembershipAuthority } from '../../../../application/ports/outbound/identity/memberships/federated-membership-authority.port.js';
import type { SessionOpener } from '../../../../application/ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import type { ChallengeTokens } from '../../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';
import type { WebAuthn } from '../../../../application/ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { AnswerChallengeWithSecurityKey } from '../../../../application/use-cases/commands/authentication/answer-challenge-with-security-key/answer-challenge-with-security-key.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { SESSION_OPENER } from '../../../tokens/accounts/session-opener.token.js';
import { FEDERATED_MEMBERSHIP_AUTHORITY } from '../../../tokens/federated-sign-in/federated-membership-authority.token.js';
import { CHALLENGE_TOKENS } from '../../../tokens/two-step/challenge-tokens.token.js';
import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';
import { WEB_AUTHN } from '../../../tokens/two-step/web-authn.token.js';

/**
 * Constant answerChallengeWithSecurityKeyProvider
 *
 * @description
 * Builds `AnswerChallengeWithSecurityKey` on the system unit of work of the accounts module, which the session it opens joins.
 *
 * @type {FactoryProvider<AnswerChallengeWithSecurityKey>}
 */
export const answerChallengeWithSecurityKeyProvider: FactoryProvider<AnswerChallengeWithSecurityKey> =
  {
    provide: AnswerChallengeWithSecurityKey,
    inject: [
      UNIT_OF_WORK,
      CHALLENGE_TOKENS,
      WEB_AUTHN,
      SESSION_OPENER,
      DEVICE_READER,
      TRUSTED_DEVICES,
      CLOCK,
      FEDERATED_MEMBERSHIP_AUTHORITY,
    ],
    useFactory: (
      unitOfWork: AccountsUnitOfWork,
      challengeTokens: ChallengeTokens,
      webAuthn: WebAuthn,
      sessions: SessionOpener,
      devices: DeviceReader,
      trustedDevices: TrustedDevices,
      clock: Clock,
      memberships: FederatedMembershipAuthority | null,
    ): AnswerChallengeWithSecurityKey =>
      new AnswerChallengeWithSecurityKey(
        unitOfWork,
        challengeTokens,
        webAuthn,
        sessions,
        devices,
        trustedDevices,
        clock,
        memberships,
      ),
  };
