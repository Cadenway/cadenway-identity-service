import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { ConfigError, loadConfig } from '@cadenway/nest-common';
import { describe, expect, it } from 'vitest';

import { appConfigSchema, migrationConfigSchema } from './app-config.js';

describe('appConfigSchema', () => {
  const trustedIssuers: string =
    '{"api-gateway":[{"kty":"OKP","crv":"Ed25519","x":"MVZQc5h6AXxnMpaBTaYw5kI-yWWawl6zp8Srhuf5NK0","kid":"local-placeholder"}]}';
  const complete: Readonly<Record<string, string>> = {
    PORT: '3010',
    DATABASE_URL: 'postgres://identity_app:identity_app@localhost:5432/identity',
    NATS_URL: 'nats://localhost:4222',
    NATS_USER: 'identity',
    NATS_PASSWORD: 'identity',
    INTERNAL_TOKEN_AUDIENCE: 'identity-service',
    INTERNAL_TOKEN_TRUSTED_ISSUERS: trustedIssuers,
    PASSWORD_PEPPER: 'local-development-password-pepper-0000000000',
    WEBAUTHN_RP_ID: 'app.cadenway.localhost',
    WEBAUTHN_ORIGINS: 'http://app.cadenway.localhost',
  };

  it('reads the variables of the service with the defaults of the kit', () => {
    expect(loadConfig(appConfigSchema, complete)).toEqual({
      NODE_ENV: 'production',
      PORT: 3010,
      LOG_LEVEL: 'info',
      LOG_PRETTY: false,
      DATABASE_URL: 'postgres://identity_app:identity_app@localhost:5432/identity',
      NATS_URL: 'nats://localhost:4222',
      NATS_USER: 'identity',
      NATS_PASSWORD: 'identity',
      INTERNAL_TOKEN_AUDIENCE: 'identity-service',
      INTERNAL_TOKEN_TRUSTED_ISSUERS: {
        'api-gateway': [
          {
            kty: 'OKP',
            crv: 'Ed25519',
            x: 'MVZQc5h6AXxnMpaBTaYw5kI-yWWawl6zp8Srhuf5NK0',
            kid: 'local-placeholder',
          },
        ],
      },
      PASSWORD_PEPPER: 'local-development-password-pepper-0000000000',
      WEBAUTHN_RP_ID: 'app.cadenway.localhost',
      WEBAUTHN_ORIGINS: ['http://app.cadenway.localhost'],
    });
  });

  it('accepts the committed .env.example as it is', () => {
    const example: NodeJS.Dict<string> = parseEnv(
      readFileSync(new URL('../../.env.example', import.meta.url), 'utf8'),
    );

    expect(() => loadConfig(appConfigSchema, example)).not.toThrow();
    expect(() => loadConfig(migrationConfigSchema, example)).not.toThrow();
  });

  it('refuses to start without the database, the broker, the audience, the issuers, the pepper or the relying party', () => {
    expect(() => loadConfig(appConfigSchema, { PORT: '3010' })).toThrow(ConfigError);
    try {
      loadConfig(appConfigSchema, { PORT: '3010' });
    } catch (error) {
      const issues: readonly string[] = (error as ConfigError).issues;
      expect(issues.map((issue) => issue.split(':')[0])).toEqual(
        expect.arrayContaining([
          'DATABASE_URL',
          'NATS_URL',
          'INTERNAL_TOKEN_AUDIENCE',
          'INTERNAL_TOKEN_TRUSTED_ISSUERS',
          'PASSWORD_PEPPER',
          'WEBAUTHN_RP_ID',
          'WEBAUTHN_ORIGINS',
        ]),
      );
    }
  });

  it('refuses a database URL that is not PostgreSQL, without printing it', () => {
    const secret: string = 'mysql://identity_app:s3cret@localhost/identity';

    expect(() => loadConfig(appConfigSchema, { ...complete, DATABASE_URL: secret })).toThrow(
      /DATABASE_URL/u,
    );
    expect(() => loadConfig(appConfigSchema, { ...complete, DATABASE_URL: secret })).not.toThrow(
      /s3cret/u,
    );
  });

  it('refuses a broker URL that is not NATS, without printing it', () => {
    const secret: string = 'http://identity:s3cret@localhost:4222';

    expect(() => loadConfig(appConfigSchema, { ...complete, NATS_URL: secret })).toThrow(
      /NATS_URL/u,
    );
    expect(() => loadConfig(appConfigSchema, { ...complete, NATS_URL: secret })).not.toThrow(
      /s3cret/u,
    );
  });

  it('refuses a private key listed as a verification key', () => {
    const withPrivateKey: string = trustedIssuers.replace('"kid"', `"d":"${'A'.repeat(43)}","kid"`);

    expect(() =>
      loadConfig(appConfigSchema, { ...complete, INTERNAL_TOKEN_TRUSTED_ISSUERS: withPrivateKey }),
    ).toThrow(/INTERNAL_TOKEN_TRUSTED_ISSUERS/u);
  });

  it('refuses a pepper shorter than 32 characters, without printing it', () => {
    const secret: string = 'short-pepper-s3cret';

    expect(() => loadConfig(appConfigSchema, { ...complete, PASSWORD_PEPPER: secret })).toThrow(
      /PASSWORD_PEPPER: Expected a secret of at least 32 characters/u,
    );
    expect(() => loadConfig(appConfigSchema, { ...complete, PASSWORD_PEPPER: secret })).not.toThrow(
      /s3cret/u,
    );
  });

  it('reads several comma-separated WebAuthn origins, trimmed', () => {
    expect(
      loadConfig(appConfigSchema, {
        ...complete,
        WEBAUTHN_RP_ID: 'app.cadenway.com',
        WEBAUTHN_ORIGINS: 'https://app.cadenway.com, https://app.cadenway.com:8443',
      }).WEBAUTHN_ORIGINS,
    ).toEqual(['https://app.cadenway.com', 'https://app.cadenway.com:8443']);
  });

  it('refuses a relying party with a scheme, a port or capitals', () => {
    for (const rpId of ['https://app.cadenway.com', 'app.cadenway.com:443', 'App.Cadenway.com']) {
      expect(() => loadConfig(appConfigSchema, { ...complete, WEBAUTHN_RP_ID: rpId })).toThrow(
        /WEBAUTHN_RP_ID/u,
      );
    }
  });

  it('refuses an origin with a path, another scheme or outside the relying party', () => {
    for (const origins of [
      'http://app.cadenway.localhost/',
      'ftp://app.cadenway.localhost',
      'http://evil.localhost',
      'http://app.cadenway.localhost.evil.example',
      '',
    ]) {
      expect(() => loadConfig(appConfigSchema, { ...complete, WEBAUTHN_ORIGINS: origins })).toThrow(
        /WEBAUTHN_ORIGINS/u,
      );
    }
  });

  it('does not read the migrator URL: the running service never needs it', () => {
    expect(loadConfig(appConfigSchema, complete)).not.toHaveProperty('MIGRATION_DATABASE_URL');
  });
});

describe('migrationConfigSchema', () => {
  it('reads the URL of the migrator role', () => {
    expect(
      loadConfig(migrationConfigSchema, {
        MIGRATION_DATABASE_URL:
          'postgres://identity_migrator:identity_migrator@localhost:5432/identity',
      }),
    ).toEqual({
      MIGRATION_DATABASE_URL:
        'postgres://identity_migrator:identity_migrator@localhost:5432/identity',
    });
  });

  it('names MIGRATION_DATABASE_URL when it is missing', () => {
    expect(() =>
      loadConfig(migrationConfigSchema, {
        DATABASE_URL: 'postgres://identity_app:identity_app@localhost:5432/identity',
      }),
    ).toThrow(/MIGRATION_DATABASE_URL: required, not set/u);
  });

  it('names MIGRATION_DATABASE_URL when it is not a PostgreSQL URL, without printing it', () => {
    const secret: string = 'mysql://identity_migrator:s3cret@localhost/identity';

    expect(() => loadConfig(migrationConfigSchema, { MIGRATION_DATABASE_URL: secret })).toThrow(
      /MIGRATION_DATABASE_URL: Expected the postgres:\/\/ URL of the migrator role/u,
    );
    expect(() => loadConfig(migrationConfigSchema, { MIGRATION_DATABASE_URL: secret })).not.toThrow(
      /s3cret/u,
    );
  });
});
