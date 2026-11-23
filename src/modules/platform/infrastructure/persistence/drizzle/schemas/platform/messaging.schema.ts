// Tables of @cadenway/nest-messaging/outbox/schema, re-exported for drizzle-kit and the
// migrations of this service: the outbox written in the transaction of a use case and published by
// the relay, the processed ids that make every handler run once per event, and the versions that
// `claimVersion` raises. Their definition belongs to the kit and is never changed here; a new kit
// version that changes them ships a migration note, applied with `pnpm migration:generate`.
export {
  eventVersions,
  outboxEvents,
  processedEvents,
} from '@cadenway/nest-messaging/outbox/schema';
