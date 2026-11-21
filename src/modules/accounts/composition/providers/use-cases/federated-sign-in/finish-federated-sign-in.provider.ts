import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../application/ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import type { ChallengeTokens } from '../../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { FederatedFinishStore } from '../../../../application/ports/outbound/transactions/federation/federated-finish-store.port.js';
import { FinishFederatedSignIn } from '../../../../application/use-cases/commands/federated-sign-in/finish-federated-sign-in/finish-federated-sign-in.use-case.js';
import { digestFederatedCredential } from '../../../../infrastructure/adapters/federated-sign-in/versioned-social-flow-credentials.adapter.js';
import { SystemFederatedFinishUnitOfWork } from '../../../../infrastructure/persistence/drizzle/transactions/federated-sign-in/system-federated-finish.unit-of-work.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { SESSION_OPENER } from '../../../tokens/accounts/session-opener.token.js';
import { FEDERATED_SIGN_IN_AUTHORITY } from '../../../tokens/federated-sign-in/federated-sign-in-authority.token.js';
import { CHALLENGE_TOKENS } from '../../../tokens/two-step/challenge-tokens.token.js';
import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';

/** Binds durable federation redemption to the ordinary account sign-in pipeline. */
export const finishFederatedSignInProvider: FactoryProvider<FinishFederatedSignIn> = {
  provide: FinishFederatedSignIn,
  inject: [
    SystemTransactionRunner,
    UNIT_OF_WORK,
    FEDERATED_SIGN_IN_AUTHORITY,
    CLOCK,
    SESSION_OPENER,
    DEVICE_READER,
    TRUSTED_DEVICES,
    CHALLENGE_TOKENS,
  ],
  useFactory: (
    runner: SystemTransactionRunner,
    accounts: AccountsUnitOfWork,
    authority: Pick<FederatedFinishStore, 'isAllowed' | 'hasActiveMembership'>,
    clock: Clock,
    sessions: SessionOpener,
    devices: DeviceReader,
    trustedDevices: TrustedDevices,
    challengeTokens: ChallengeTokens,
  ): FinishFederatedSignIn =>
    new FinishFederatedSignIn(
      new SystemFederatedFinishUnitOfWork(runner, accounts, authority),
      { digest: digestFederatedCredential },
      clock,
      sessions,
      devices,
      trustedDevices,
      challengeTokens,
    ),
};
