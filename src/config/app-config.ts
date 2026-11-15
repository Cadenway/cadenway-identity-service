import { baseConfigShape, internalTokenVerifierConfigShape } from '@cadenway/nest-common';
import type { BaseConfig, InternalTokenVerifierConfig } from '@cadenway/nest-common';
import { databaseConfigShape } from '@cadenway/nest-common/database';
import type { DatabaseConfig } from '@cadenway/nest-common/database';
import { messagingConfigShape } from '@cadenway/nest-messaging';
import type { MessagingConfig } from '@cadenway/nest-messaging';
import { z } from 'zod';

/**
 * Type AppConfig
 *
 * @description
 * Variables the running service reads, validated when the application is created: by `loadConfig`
 * in `main.ts` for the options of `createApplication`, and by `ConfigModule` for the providers that
 * inject `CONFIG`.
 *
 * - `NODE_ENV`, `PORT`, `LOG_LEVEL`, `LOG_PRETTY`: `baseConfigShape` of `@cadenway/nest-common`;
 *   `PORT` is required, the others default to `production`, `info` and `false`.
 * - `DATABASE_URL`: the application role of this service's own database (`identity_app`), subject to
 *   row-level security and holding no DDL right.
 * - `NATS_URL`, `NATS_USER`, `NATS_PASSWORD`: `messagingConfigShape` of `@cadenway/nest-messaging`.
 *   `NATS_URL` is required; the user (`identity`) and its password are optional for the kit, which
 *   accepts an anonymous local broker, but every broker of Cadenway refuses a connection without
 *   them.
 * - `INTERNAL_TOKEN_AUDIENCE` and `INTERNAL_TOKEN_TRUSTED_ISSUERS`: the `aud` this service accepts
 *   and the public keys of the backends allowed to call it.
 * - `PASSWORD_PEPPER`: `passwordPepperConfigShape`, the secret mixed into every password hash and
 *   one-time code hash.
 *
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is read by `telemetry.ts`, before the application exists.
 *
 * @type {BaseConfig & DatabaseConfig & MessagingConfig & InternalTokenVerifierConfig & PasswordPepperConfig}
 */
export type AppConfig = BaseConfig &
  DatabaseConfig &
  MessagingConfig &
  InternalTokenVerifierConfig &
  PasswordPepperConfig;

/**
 * Interface PasswordPepperConfig
 *
 * @description
 * The secret of this service that never sits in its database (`cw-identity-security`).
 */
export interface PasswordPepperConfig {
  // #region Properties
  /**
   * Property PASSWORD_PEPPER
   *
   * @description
   * Secret of at least 32 characters, passed to argon2id as its secret key for every password hash
   * and used to derive the key of the one-time code hashes. cadenway-ops maps it from
   * `IDENTITY_PASSWORD_PEPPER`. Changing it makes every stored password and pending code unusable:
   * there is no rotation yet.
   *
   * @type {string}
   * @readonly
   */
  readonly PASSWORD_PEPPER: string;
  // #endregion
}

/**
 * Constant passwordPepperConfigShape
 *
 * @description
 * Zod shape of `PasswordPepperConfig`. A pepper shorter than 32 characters is refused at start-up,
 * named without its value.
 *
 * @type {{ readonly PASSWORD_PEPPER: z.ZodString }}
 */
export const passwordPepperConfigShape: { readonly PASSWORD_PEPPER: z.ZodString } = {
  PASSWORD_PEPPER: z.string().min(32, { error: 'Expected a secret of at least 32 characters.' }),
};

/**
 * Constant appConfigSchema
 *
 * @description
 * Zod schema of `AppConfig`, composed from the shapes of `@cadenway/nest-common` and
 * `@cadenway/nest-messaging` so the names, defaults and validation stay those of the kit. A missing
 * or invalid variable makes `loadConfig` throw a `ConfigError` that names it without printing its
 * value.
 *
 * @type {z.ZodType<AppConfig>}
 */
export const appConfigSchema: z.ZodType<AppConfig> = z.object({
  ...baseConfigShape,
  ...databaseConfigShape,
  ...messagingConfigShape,
  ...internalTokenVerifierConfigShape,
  ...passwordPepperConfigShape,
});

/**
 * Interface MigrationConfig
 *
 * @description
 * Variable the one-off migration container reads (`node dist/migrate.js`). The running service
 * never reads it: only the migrator role may change the structure of the database.
 */
export interface MigrationConfig {
  // #region Properties
  /**
   * Property MIGRATION_DATABASE_URL
   *
   * @description
   * Connection string of the migrator role (`identity_migrator`), which owns the tables and runs the
   * DDL. A secret; cadenway-ops passes it from `IDENTITY_SERVICE_MIGRATION_DATABASE_URL`.
   *
   * @type {string}
   * @readonly
   */
  readonly MIGRATION_DATABASE_URL: string;
  // #endregion
}

/**
 * Constant migrationConfigSchema
 *
 * @description
 * Zod schema of `MigrationConfig`: a `postgres://` or `postgresql://` URL, like `DATABASE_URL`.
 *
 * @type {z.ZodType<MigrationConfig>}
 */
export const migrationConfigSchema: z.ZodType<MigrationConfig> = z.object({
  MIGRATION_DATABASE_URL: z.url({
    protocol: /^postgres(?:ql)?$/u,
    error: 'Expected the postgres:// URL of the migrator role.',
  }),
});
