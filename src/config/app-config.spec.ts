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
      DATABASE_TRANSACTION_MAX_ATTEMPTS: 3,
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
      AUTHENTICATION_COUNTER_RETENTION_ENABLED: false,
    });
  });

  it('requires an explicit opt-in for authentication counter retention', () => {
    const config = loadConfig(appConfigSchema, {
      ...complete,
      AUTHENTICATION_COUNTER_RETENTION_ENABLED: 'true',
    });
    expect(config.AUTHENTICATION_COUNTER_RETENTION_ENABLED).toBe(true);
    expect(() =>
      loadConfig(appConfigSchema, { ...complete, AUTHENTICATION_COUNTER_RETENTION_ENABLED: '1' }),
    ).toThrow(/AUTHENTICATION_COUNTER_RETENTION_ENABLED/u);
  });

  it('accepts one transaction attempt to disable retries', () => {
    const config = loadConfig(appConfigSchema, {
      ...complete,
      DATABASE_TRANSACTION_MAX_ATTEMPTS: '1',
    });

    expect(config.DATABASE_TRANSACTION_MAX_ATTEMPTS).toBe(1);
  });

  it('trusts the separate public Organization issuer without replacing existing issuers', () => {
    const key = { kty: 'OKP', crv: 'Ed25519', x: 'C'.repeat(43), kid: 'organization-fixture' };
    const config = loadConfig(appConfigSchema, {
      ...complete,
      ORGANIZATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS: JSON.stringify(key),
    });
    expect(config.INTERNAL_TOKEN_TRUSTED_ISSUERS).toMatchObject({ 'organization-service': [key] });
    expect(config.INTERNAL_TOKEN_TRUSTED_ISSUERS['api-gateway']).toHaveLength(1);
    expect(() =>
      loadConfig(appConfigSchema, {
        ...complete,
        ORGANIZATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS: JSON.stringify({ ...key, d: 'fixture' }),
      }),
    ).toThrow(/ORGANIZATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS/u);
  });

  describe('current membership authority', () => {
    const origin = 'http://organization-service:3011';
    const signingKey = {
      kty: 'OKP',
      crv: 'Ed25519',
      kid: 'identity-fixture',
      x: 'A'.repeat(43),
      d: 'B'.repeat(43),
    };

    it('reads the origin with a separately validated Identity signing key', () => {
      const config = loadConfig(appConfigSchema, {
        ...complete,
        ORGANIZATION_SERVICE_URL: origin,
        IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK: JSON.stringify(signingKey),
      });

      expect(config.ORGANIZATION_SERVICE_URL).toBe(origin);
      expect(config.IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK).toStrictEqual(signingKey);
    });

    it('requires the origin and signing key together', () => {
      expect(() =>
        loadConfig(appConfigSchema, { ...complete, ORGANIZATION_SERVICE_URL: origin }),
      ).toThrow(/IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK/u);
      expect(() =>
        loadConfig(appConfigSchema, {
          ...complete,
          IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK: JSON.stringify(signingKey),
        }),
      ).toThrow(/ORGANIZATION_SERVICE_URL/u);
    });

    it.each([
      'https://example.test/organization',
      'https://example.test?query=embedded',
      'https://example.test#fragment',
      'https://example-user:example-password@example.test',
      'ftp://example.test',
    ])('rejects a non-origin URL without including its value', (url) => {
      const load = () =>
        loadConfig(appConfigSchema, {
          ...complete,
          ORGANIZATION_SERVICE_URL: url,
          IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK: JSON.stringify(signingKey),
        });

      expect(load).toThrow(/ORGANIZATION_SERVICE_URL/u);
      expect(load).not.toThrow(url);
    });

    it('rejects a malformed private key without disclosing its content', () => {
      const load = () =>
        loadConfig(appConfigSchema, {
          ...complete,
          ORGANIZATION_SERVICE_URL: origin,
          IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK: 'malformed-fixture',
        });
      expect(load).toThrow(/IDENTITY_SERVICE_INTERNAL_TOKEN_PRIVATE_JWK/u);
      expect(load).not.toThrow(/malformed-fixture/u);
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

  it.each(['', 'null'])('leaves Notification trust disabled for %j', (keys) => {
    expect(
      loadConfig(appConfigSchema, {
        ...complete,
        NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS: keys,
      }).INTERNAL_TOKEN_TRUSTED_ISSUERS,
    ).not.toHaveProperty('notification-service');
  });

  it('trusts both public Notification keys during rotation', () => {
    const firstKey = { kty: 'OKP', crv: 'Ed25519', x: 'A'.repeat(43), kid: 'first' };
    const secondKey = { ...firstKey, x: 'B'.repeat(43), kid: 'second' };
    const keys = [JSON.stringify(firstKey), JSON.stringify(secondKey)].join(',');

    const config = loadConfig(appConfigSchema, {
      ...complete,
      NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS: keys,
    });
    expect(config.INTERNAL_TOKEN_TRUSTED_ISSUERS['notification-service']).toEqual([
      firstKey,
      secondKey,
    ]);
    expect(config.INTERNAL_TOKEN_TRUSTED_ISSUERS['api-gateway']).toHaveLength(1);
  });

  it('refuses a private key in the hosted public-key list without printing it', () => {
    const keys = JSON.stringify({
      kty: 'OKP',
      crv: 'Ed25519',
      x: 'A'.repeat(43),
      kid: 'notification',
      d: 'B'.repeat(43),
    });
    const read = () =>
      loadConfig(appConfigSchema, {
        ...complete,
        NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS: keys,
      });

    expect(read).toThrow(/NOTIFICATION_SERVICE_INTERNAL_TOKEN_PUBLIC_JWKS/u);
    expect(read).not.toThrow(/B{43}/u);
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
