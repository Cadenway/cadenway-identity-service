import type { FactoryProvider } from '@nestjs/common';

import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import type { TwoStepEnrollments } from '../../../../application/ports/outbound/identity/sessions/two-step-enrollments.port.js';
import type { TwoStepRequirements } from '../../../../application/ports/outbound/identity/sessions/two-step-requirements.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { DisableTwoStepVerification } from '../../../../application/use-cases/commands/two-step/disable-two-step-verification/disable-two-step-verification.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';
import { TWO_STEP_ENROLLMENTS } from '../../../tokens/two-step/two-step-enrollments.token.js';
import { TWO_STEP_REQUIREMENTS } from '../../../tokens/two-step/two-step-requirements.token.js';

/**
 * Constant disableTwoStepVerificationProvider
 *
 * @description
 * Builds `DisableTwoStepVerification` on the system unit of work of the accounts module, which the sessions module joins.
 *
 * @type {FactoryProvider<DisableTwoStepVerification>}
 */
export const disableTwoStepVerificationProvider: FactoryProvider<DisableTwoStepVerification> = {
  provide: DisableTwoStepVerification,
  inject: [
    UNIT_OF_WORK,
    ACCOUNT_SESSIONS,
    TWO_STEP_REQUIREMENTS,
    TWO_STEP_ENROLLMENTS,
    TRUSTED_DEVICES,
    DEVICE_READER,
  ],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    requirements: TwoStepRequirements,
    enrollments: TwoStepEnrollments,
    trustedDevices: TrustedDevices,
    devices: DeviceReader,
  ): DisableTwoStepVerification =>
    new DisableTwoStepVerification(
      unitOfWork,
      sessions,
      requirements,
      enrollments,
      trustedDevices,
      devices,
    ),
};
