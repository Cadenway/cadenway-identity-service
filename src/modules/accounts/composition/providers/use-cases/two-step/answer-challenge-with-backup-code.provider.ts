import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { FederatedMembershipAuthority } from '../../../../application/ports/outbound/identity/memberships/federated-membership-authority.port.js';
import type { SessionOpener } from '../../../../application/ports/outbound/identity/sessions/session-opener.port.js';
import type { TrustedDevices } from '../../../../application/ports/outbound/identity/sessions/trusted-devices.port.js';
import type { BackupCodeSecrets } from '../../../../application/ports/outbound/security/two-step/backup-code-secrets.port.js';
import type { ChallengeTokens } from '../../../../application/ports/outbound/security/two-step/challenge-tokens.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { AnswerChallengeWithBackupCode } from '../../../../application/use-cases/commands/authentication/answer-challenge-with-backup-code/answer-challenge-with-backup-code.use-case.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { SESSION_OPENER } from '../../../tokens/accounts/session-opener.token.js';
import { FEDERATED_MEMBERSHIP_AUTHORITY } from '../../../tokens/federated-sign-in/federated-membership-authority.token.js';
import { BACKUP_CODE_SECRETS } from '../../../tokens/two-step/backup-code-secrets.token.js';
import { CHALLENGE_TOKENS } from '../../../tokens/two-step/challenge-tokens.token.js';
import { TRUSTED_DEVICES } from '../../../tokens/two-step/trusted-devices.token.js';

/**
 * Constant answerChallengeWithBackupCodeProvider
 *
 * @description
 * Builds `AnswerChallengeWithBackupCode` on the system unit of work of the accounts module, which the session it opens joins.
 *
 * @type {FactoryProvider<AnswerChallengeWithBackupCode>}
 */
export const answerChallengeWithBackupCodeProvider: FactoryProvider<AnswerChallengeWithBackupCode> =
  {
    provide: AnswerChallengeWithBackupCode,
    inject: [
      UNIT_OF_WORK,
      CHALLENGE_TOKENS,
      BACKUP_CODE_SECRETS,
      SESSION_OPENER,
      DEVICE_READER,
      TRUSTED_DEVICES,
      CLOCK,
      FEDERATED_MEMBERSHIP_AUTHORITY,
    ],
    useFactory: (
      unitOfWork: AccountsUnitOfWork,
      challengeTokens: ChallengeTokens,
      backupCodeSecrets: BackupCodeSecrets,
      sessions: SessionOpener,
      devices: DeviceReader,
      trustedDevices: TrustedDevices,
      clock: Clock,
      memberships: FederatedMembershipAuthority | null,
    ): AnswerChallengeWithBackupCode =>
      new AnswerChallengeWithBackupCode(
        unitOfWork,
        challengeTokens,
        backupCodeSecrets,
        sessions,
        devices,
        trustedDevices,
        clock,
        memberships,
      ),
  };
