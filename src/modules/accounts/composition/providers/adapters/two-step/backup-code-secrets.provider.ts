import { CONFIG } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import type { BackupCodeSecrets } from '../../../../application/ports/outbound/security/two-step/backup-code-secrets.port.js';
import { HmacBackupCodeSecrets } from '../../../../infrastructure/adapters/security/hmac-backup-code-secrets.adapter.js';
import { BACKUP_CODE_SECRETS } from '../../../tokens/two-step/backup-code-secrets.token.js';

/**
 * Constant backupCodeSecretsProvider
 *
 * @description
 * Hashes the backup codes with HMAC-SHA-256 under a key derived from `PASSWORD_PEPPER`.
 *
 * @type {FactoryProvider<BackupCodeSecrets>}
 */
export const backupCodeSecretsProvider: FactoryProvider<BackupCodeSecrets> = {
  provide: BACKUP_CODE_SECRETS,
  inject: [CONFIG],
  useFactory: (config: AppConfig): BackupCodeSecrets =>
    new HmacBackupCodeSecrets(config.PASSWORD_PEPPER),
};
