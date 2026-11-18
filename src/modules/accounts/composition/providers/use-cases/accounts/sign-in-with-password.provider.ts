import type { FactoryProvider } from '@nestjs/common';

import { CHALLENGE_TOKENS } from '../../../tokens/two-step/challenge-tokens.token.js';
import type { ChallengeTokens } from '../../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';
import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../application/ports/outbound/identity/sessions/session-opener.port.js';
import type { PasswordHasher } from '../../../../application/ports/outbound/security/authentication/password-hasher.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { SignInWithPassword } from '../../../../application/use-cases/commands/authentication/sign-in-with-password/sign-in-with-password.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { PASSWORD_HASHER } from '../../../tokens/accounts/password-hasher.token.js';
import { SESSION_OPENER } from '../../../tokens/accounts/session-opener.token.js';

/**
 * Constant signInWithPasswordProvider
 *
 * @description
 * Builds SignInWithPassword with the dependencies configured by the Accounts module.
 *
 * @type {FactoryProvider<SignInWithPassword>}
 */
export const signInWithPasswordProvider: FactoryProvider<SignInWithPassword> = {
  provide: SignInWithPassword,
  inject: [
    UNIT_OF_WORK,
    PASSWORD_HASHER,
    SESSION_OPENER,
    CLOCK,
    DEVICE_READER,
    TRUSTED_DEVICES,
    CHALLENGE_TOKENS,
  ],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    hasher: PasswordHasher,
    sessions: SessionOpener,
    clock: Clock,
    devices: DeviceReader,
    trustedDevices: TrustedDevices,
    challengeTokens: ChallengeTokens,
  ): SignInWithPassword =>
    new SignInWithPassword(
      unitOfWork,
      hasher,
      sessions,
      clock,
      devices,
      trustedDevices,
      challengeTokens,
    ),
};
