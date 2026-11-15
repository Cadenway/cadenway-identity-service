import { createApplication } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { config } from './config/config.js';

// Started after `telemetry.js`: `node --experimental-loader=@cadenway/nest-common/hook.mjs
// --import ./dist/telemetry.js dist/main.js` (Dockerfile and `pnpm start:dev`).
/**
 * Constant app
 *
 * @description
 * Nest application serving the internal HTTP API, with every shared format of
 * `@cadenway/nest-common` applied: JSON log lines, `application/problem+json` errors, zod
 * validation, entity tags, a 1 MB JSON body limit, a 10 second request budget and shutdown hooks
 * that drain connections before the process exits.
 *
 * Every route but the health probes requires an internal token whose `aud` is
 * `INTERNAL_TOKEN_AUDIENCE` and whose signature verifies with a key of
 * `INTERNAL_TOKEN_TRUSTED_ISSUERS`; the organization of a request comes from that token only.
 *
 * @type {NestExpressApplication}
 */
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
