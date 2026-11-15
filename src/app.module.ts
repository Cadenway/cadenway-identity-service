import { HealthModule, postgresIndicator } from '@cadenway/nest-common';
import type { PostgresProbe } from '@cadenway/nest-common';
import { DATABASE_POOL, DatabaseModule } from '@cadenway/nest-common/database';
import { Module } from '@nestjs/common';

import { config } from './config/config.js';

/**
 * Class AppModule
 *
 * @description
 * Root module of the service. `createApplication` of `@cadenway/nest-common` wraps it with the
 * logs, the `application/problem+json` errors, the validation pipe, the internal token guard and
 * the other shared formats; this module declares what the service itself depends on.
 *
 * - `DatabaseModule`: the pool of this service's own database, opened as the application role of
 *   `DATABASE_URL`, and the tenant and system transaction runners. No connection is opened before
 *   the first transaction or probe; the pool closes on shutdown.
 * - `HealthModule`: `GET /health/live` answers as soon as the process runs; `GET /health/ready`
 *   answers 503 while PostgreSQL does not answer `select 1` within 1 second. Both routes are exempt
 *   from the internal token, every other route requires it.
 *
 * Business modules under `src/modules/` are registered here as they are created. The NATS
 * indicator joins readiness with `@cadenway/nest-messaging`, which owns the connection.
 */
@Module({
  imports: [
    DatabaseModule.forRoot({
      connectionString: config.DATABASE_URL,
      applicationName: 'identity-service',
    }),
    HealthModule.forRootAsync({
      inject: [DATABASE_POOL],
      useFactory: (pool: PostgresProbe) => ({ indicators: [postgresIndicator(pool)] }),
    }),
  ],
})
export class AppModule {}
