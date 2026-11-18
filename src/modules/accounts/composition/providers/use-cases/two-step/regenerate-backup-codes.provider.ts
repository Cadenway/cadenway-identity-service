import type { FactoryProvider } from '@nestjs/common';

import type { Clock } from '../../../../application/ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../application/ports/outbound/device/accounts/device-reader.port.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import type { BackupCodeSecrets } from '../../../../application/ports/outbound/security/two-step/backup-code-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../application/ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import { RegenerateBackupCodes } from '../../../../application/use-cases/commands/two-step/regenerate-backup-codes/regenerate-backup-codes.use-case.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';
import { UNIT_OF_WORK } from '../../../tokens/accounts/accounts-unit-of-work.token.js';
import { CLOCK } from '../../../tokens/accounts/clock.token.js';
import { DEVICE_READER } from '../../../tokens/accounts/device-reader.token.js';
import { BACKUP_CODE_SECRETS } from '../../../tokens/two-step/backup-code-secrets.token.js';

/**
 * Constant regenerateBackupCodesProvider
 *
 * @description
 * Builds `RegenerateBackupCodes` on the system unit of work of the accounts module.
 *
 * @type {FactoryProvider<RegenerateBackupCodes>}
 */
export const regenerateBackupCodesProvider: FactoryProvider<RegenerateBackupCodes> = {
  provide: RegenerateBackupCodes,
  inject: [UNIT_OF_WORK, ACCOUNT_SESSIONS, BACKUP_CODE_SECRETS, DEVICE_READER, CLOCK],
  useFactory: (
    unitOfWork: AccountsUnitOfWork,
    sessions: AccountSessions,
    backupCodeSecrets: BackupCodeSecrets,
    devices: DeviceReader,
    clock: Clock,
  ): RegenerateBackupCodes =>
    new RegenerateBackupCodes(unitOfWork, sessions, backupCodeSecrets, devices, clock),
};
