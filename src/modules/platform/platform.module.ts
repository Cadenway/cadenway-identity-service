import { Module } from '@nestjs/common';

/**
 * Class PlatformModule
 *
 * @description
 * Owner, inside this service, of the tables the service kit stores in the service's own database:
 * the outbox, processed-ids and versions tables of `@cadenway/nest-messaging/outbox` and the
 * `Idempotency-Key` table of `@cadenway/nest-common/database`. Its persistence layer re-exports them
 * so that drizzle-kit, which reads `src/modules/<module>/infrastructure/persistence/*.schema.ts`
 * only, writes them into the migrations of the service.
 *
 * It declares no provider, controller or handler and holds no business rule: what reads and writes
 * the tables is the kit, through `DatabaseModule`, `MessagingModule` and `OutboxModule`, registered
 * in `AppModule`. See its `MODULE.md`.
 */
@Module({})
export class PlatformModule {}
