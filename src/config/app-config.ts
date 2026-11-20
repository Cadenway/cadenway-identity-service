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
 *   and the public keys of the backends allowed to call it. Hosting can add verified Notification
 *   public keys through `NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS`.
 * - `PASSWORD_PEPPER`: `passwordPepperConfigShape`, the secret every key of the service derives
 *   from: the secret key of the password hashes, the key of the one-time code hashes, the key that
 *   seals the authenticator-app secrets and the key of the backup code hashes.
 * - `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGINS`: `webAuthnConfigShape`, the relying party of the
 *   security keys and the exact origins a key may answer from.
 *
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is read by `telemetry.ts`, before the application exists.
 *
 * @type {BaseConfig & DatabaseConfig & MessagingConfig & InternalTokenVerifierConfig & PasswordPepperConfig & WebAuthnConfig}
 */
export type AppConfig = BaseConfig &
  DatabaseConfig &
  MessagingConfig &
  InternalTokenVerifierConfig &
  PasswordPepperConfig &
  WebAuthnConfig;

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
   * Secret of at least 32 characters, kept outside the database. Each key of the service is derived
   * from it by HKDF-SHA-256 under its own label: the secret key argon2id mixes into every password
   * hash, the key of the one-time code hashes, the key that seals the secret of each authenticator
   * app (AES-256-GCM, with the version of the key stored beside each sealed secret) and the key of
   * the backup code hashes. cadenway-ops maps it from `IDENTITY_PASSWORD_PEPPER`. Changing it makes
   * every stored password, pending code, authenticator app and backup code unusable: there is no
   * rotation yet.
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
 * Interface WebAuthnConfig
 *
 * @description
 * The relying party of the security keys (`@simplewebauthn/server`), set by cadenway-ops from
 * `DOMAIN` and `PUBLIC_SCHEME` (`docs/service-environment.md` there). Not secret.
 */
export interface WebAuthnConfig {
  // #region Properties
  /**
   * Property WEBAUTHN_RP_ID
   *
   * @description
   * The relying-party id a browser binds each key to: the host of the web application,
   * `app.${DOMAIN}` (`app.cadenway.localhost` locally). A host name, lowercase, without a scheme,
   * a port or a path.
   *
   * @type {string}
   * @readonly
   */
  readonly WEBAUTHN_RP_ID: string;

  /**
   * Property WEBAUTHN_ORIGINS
   *
   * @description
   * The exact origins a key may be registered or used from, comma-separated in the environment
   * (`${PUBLIC_SCHEME:-https}://app.${DOMAIN}`): the web application only. Compared exactly with the
   * `origin` of `clientDataJSON`, never by suffix or pattern.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly WEBAUTHN_ORIGINS: readonly string[];
  // #endregion
}

/**
 * Constant webAuthnConfigShape
 *
 * @description
 * Zod shape of `WebAuthnConfig`. The relying party is a host name of at least one dot-free label;
 * each origin is `http://` or `https://`, a host and an optional port, without a path, and its
 * host is the relying party or one of its subdomains, as WebAuthn requires. A value that breaks
 * this is refused at start-up.
 *
 * @type {{ readonly WEBAUTHN_RP_ID: z.ZodString; readonly WEBAUTHN_ORIGINS: z.ZodType<readonly string[]> }}
 */
export const webAuthnConfigShape: {
  readonly WEBAUTHN_RP_ID: z.ZodString;
  readonly WEBAUTHN_ORIGINS: z.ZodType<readonly string[]>;
} = {
  WEBAUTHN_RP_ID: z
    .string()
    .regex(
      /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/u,
      {
        error: 'Expected a lowercase host name, without a scheme, a port or a path.',
      },
    ),
  WEBAUTHN_ORIGINS: z
    .string()
    .transform((value: string): string[] =>
      value
        .split(',')
        .map((origin: string): string => origin.trim())
        .filter((origin: string): boolean => origin !== ''),
    )
    .pipe(
      z
        .array(
          z.string().regex(/^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/u, {
            error: 'Expected an http:// or https:// origin without a path.',
          }),
        )
        .min(1, { error: 'Expected at least one origin.' }),
    ),
};

/**
 * Function originsMatchRelyingParty
 *
 * @description
 * Whether every origin's host is the relying party or one of its subdomains, the WebAuthn rule a
 * browser applies before it uses a key; checked once at start-up by `appConfigSchema`.
 *
 * @param {Readonly<WebAuthnConfig>} config - The relying party and its origins.
 * @returns {boolean} `true` when every origin may use the relying party.
 */
function originsMatchRelyingParty(config: Readonly<WebAuthnConfig>): boolean {
  return config.WEBAUTHN_ORIGINS.every((origin: string): boolean => {
    const host: string = new URL(origin).hostname;
    return host === config.WEBAUTHN_RP_ID || host.endsWith(`.${config.WEBAUTHN_RP_ID}`);
  });
}

/** Validates the hosted public-key list with the same schema as the explicit issuer map. */
const notificationPublicKeys = z
  .string()
  .trim()
  .nullish()
  .transform(
    (value, context): InternalTokenVerifierConfig['INTERNAL_TOKEN_TRUSTED_ISSUERS'] | undefined => {
      if (value == null || value === '' || value === 'null') {
        return undefined;
      }
      try {
        const keys: unknown = JSON.parse(`[${value}]`);
        const issuers = internalTokenVerifierConfigShape.INTERNAL_TOKEN_TRUSTED_ISSUERS.safeParse(
          JSON.stringify({ 'notification-service': keys }),
        );
        if (issuers.success) {
          return issuers.data;
        }
      } catch {
        // Never echo the raw JSON or unknown JWK properties in a configuration issue.
      }
      context.addIssue({ code: 'custom', message: 'Expected comma-separated public JWK objects.' });
      return z.NEVER;
    },
  );

/**
 * Constant appConfigSchema
 *
 * @description
 * Zod schema of `AppConfig`, composed from the shapes of `@cadenway/nest-common` and
 * `@cadenway/nest-messaging` so the names, defaults and validation stay those of the kit. A missing
 * or invalid variable makes `loadConfig` throw a `ConfigError` that names it without printing its
 * value; so does an origin of `WEBAUTHN_ORIGINS` outside `WEBAUTHN_RP_ID`.
 *
 * @type {z.ZodType<AppConfig>}
 */
export const appConfigSchema: z.ZodType<AppConfig> = z
  .object({
    ...baseConfigShape,
    ...databaseConfigShape,
    ...messagingConfigShape,
    ...internalTokenVerifierConfigShape,
    NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS: notificationPublicKeys,
    ...passwordPepperConfigShape,
    ...webAuthnConfigShape,
  })
  .refine(originsMatchRelyingParty, {
    path: ['WEBAUTHN_ORIGINS'],
    error: 'Expected origins on the relying party WEBAUTHN_RP_ID or one of its subdomains.',
  })
  .transform(({ NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS, ...config }): AppConfig => ({
    ...config,
    INTERNAL_TOKEN_TRUSTED_ISSUERS: {
      ...NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS,
      ...config.INTERNAL_TOKEN_TRUSTED_ISSUERS,
    },
  }));

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
