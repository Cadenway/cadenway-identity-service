import { RESTRICTED_EVENT_NAMES } from '@cadenway/contracts/events/identity-service';
import { CONFIG, HealthModule, postgresIndicator } from '@cadenway/nest-common';
import type { PostgresProbe } from '@cadenway/nest-common';
import { DATABASE_POOL, DatabaseModule } from '@cadenway/nest-common/database';
import {
  MessagingConnection,
  MessagingModule,
  messagingHealthIndicator,
} from '@cadenway/nest-messaging';
import { JobsRuntimeModule } from '@cadenway/nest-jobs/runtime';
import { OutboxModule } from '@cadenway/nest-messaging/outbox';
import { Module } from '@nestjs/common';

import type { AppConfig } from './config/app-config.js';
import { jobQueues } from './config/job-queues.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { ApiTokensModule } from './modules/api-tokens/api-tokens.module.js';
import { MembershipsModule } from './modules/memberships/memberships.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';

/**
 * Class AppModule
 *
 * @description
 * Root module of the service. `createApplication` of `@cadenway/nest-common` wraps it with the
 * logs, the `application/problem+json` errors, the validation pipe, the internal token guard and
 * the other shared formats; this module declares what the service itself depends on. Importing it
 * reads no configuration: every module below is built when the application is created.
 *
 * - `CONFIG`: the configuration `main.ts` validated once with `loadConfig`, provided globally by
 *   `createApplication` (`provideConfig: true`); this module imports no `ConfigModule`, so the
 *   environment is never validated twice. A test hands its own with `provideConfig` too.
 * - `DatabaseModule`: the pool of this service's own database, opened as the application role of
 *   `DATABASE_URL`, the tenant and system transaction runners, and the `Idempotency-Key`
 *   interceptor for the routes marked `@Idempotent()`. The pool closes on shutdown.
 * - `MessagingModule`: the NATS connection of the `identity` user, with the inbox prefix
 *   `_INBOX.identity` the broker requires. The creation waits for the first connection, then checks
 *   that the `EVENTS` stream exists, and `EVENTS_RESTRICTED` since the service lists restricted
 *   events: cadenway-ops creates the streams (`manageStreams: false`), and only
 *   notification-service runs the dead-letter worker. `restrictedEvents` is the
 *   `RESTRICTED_EVENT_NAMES` of `@cadenway/contracts/events/identity-service`
 *   (`one-time-code.issued.v1` and `password-reset-link.issued.v1`, which carry a single-use code
 *   or link): the outbox writes them on `restricted.<name>`, into `EVENTS_RESTRICTED`, which
 *   notification-service alone reads.
 * - `OutboxModule`: the outbox writer, the PostgreSQL deduplicator and the relay, which polls
 *   `outbox_events` every second in a system transaction and publishes the pending rows. It runs in
 *   every replica; `for update skip locked` keeps two of them from publishing the same row.
 * - `HealthModule`: `GET /health/live` answers as soon as the process runs; `GET /health/ready`
 *   answers 503 while PostgreSQL or NATS does not answer within 1 second, and from the start of a
 *   shutdown. Both routes are exempt from the internal token, every other route requires it.
 *   `shutdownDelayMs` is 0: nothing that routes to this internal service reads its readiness.
 *   Callers reach it through the Docker DNS of the `internal` network, which keeps returning a
 *   stopping container until it exits, whatever its health (checked on Docker 28.2), and the GitOps
 *   agent only waits for the new container to be healthy before it stops the old one. A delay would
 *   lengthen every stop, under the 10 second default grace period of Docker, without moving any
 *   request away; set it above the probe interval of a proxy if one ever routes on readiness.
 * - `JobsRuntimeModule`: the durable jobs of `@cadenway/nest-jobs`, on pg-boss in the `pgboss`
 *   schema of this service's own database, as the application role of `DATABASE_URL`, with a pool
 *   of two connections of its own (the producer enqueues through the transaction of the use case).
 *   Every replica is producer, worker and scheduler: the schedules are durable rows, one job per
 *   occurrence whatever the number of replicas. `src/migrate.ts` provisions the schema and the
 *   queues of `src/config/job-queues.ts` as the migrator role; the start-up fails while they are
 *   missing. Running jobs get 30 seconds to finish at shutdown.
 * - `PlatformModule`: the owner of the kit tables in the migrations of the service.
 * - `AccountsModule`: users, password credentials, one-time codes, reset links, pending changes of
 *   address and the password lockout, with the authentication flows, the reading of a user, the
 *   security of the account and the jobs that complete the scheduled deletions.
 * - `MembershipsModule`: the copy of the memberships of organization-service, fed by the member
 *   events (`member.joined.v1`, `member.role-changed.v1`, `member.removed.v1`), which the choice of
 *   an organization and both introspections read.
 * - `SessionsModule`: sessions, their current organization, their introspection and their
 *   revocation.
 * - `ApiTokensModule`: the personal API tokens and their introspection.
 */
@Module({
  imports: [
    DatabaseModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        connectionString: config.DATABASE_URL,
        applicationName: 'identity-service',
        idempotency: true,
        transactionMaxAttempts: config.DATABASE_TRANSACTION_MAX_ATTEMPTS,
      }),
    }),
    MessagingModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        service: 'identity-service',
        servers: config.NATS_URL,
        user: config.NATS_USER,
        password: config.NATS_PASSWORD,
        manageStreams: false,
        deadLetterWorker: false,
        restrictedEvents: RESTRICTED_EVENT_NAMES,
      }),
    }),
    OutboxModule.forRoot(),
    JobsRuntimeModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: { connectionString: config.DATABASE_URL },
        queues: jobQueues,
        capabilities: ['producer', 'worker', 'scheduler'],
        poolSize: 2,
      }),
    }),
    HealthModule.forRootAsync({
      inject: [DATABASE_POOL, MessagingConnection],
      useFactory: (pool: PostgresProbe, connection: MessagingConnection) => ({
        indicators: [postgresIndicator(pool), messagingHealthIndicator(connection)],
        shutdownDelayMs: 0,
      }),
    }),
    PlatformModule,
    MembershipsModule,
    SessionsModule,
    AccountsModule,
    ApiTokensModule,
  ],
})
export class AppModule {}
