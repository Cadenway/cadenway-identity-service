import { createApplication, loadConfig, runApplication } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { appConfigSchema } from './config/app-config.js';
import type { AppConfig } from './config/app-config.js';

// Started after the instrumentation hooks and `telemetry.js`, with the heap capped for the 256M
// container: `node --max-old-space-size=160 --import @cadenway/nest-common/register
// --import ./dist/telemetry.js dist/main.js` (the Dockerfile CMD and `pnpm start:dev`).
//
// `runApplication` turns a failed start-up (an invalid environment, NATS without the EVENTS stream,
// a port in use) into one JSON line on the standard error and exit code 1. Every route but the
// health probes requires an internal token whose `aud` is INTERNAL_TOKEN_AUDIENCE and whose
// signature verifies with a key of INTERNAL_TOKEN_TRUSTED_ISSUERS; the organization of a request
// comes from that token only.
await runApplication({ service: 'identity-service' }, async (): Promise<void> => {
  const config: Readonly<AppConfig> = loadConfig(appConfigSchema);
  const app: NestExpressApplication = await createApplication(AppModule, {
    service: 'identity-service',
    config,
    internalToken: {
      verifier: {
        audience: config.INTERNAL_TOKEN_AUDIENCE,
        trustedIssuers: config.INTERNAL_TOKEN_TRUSTED_ISSUERS,
      },
    },
  });
  await app.listen(config.PORT);
});
