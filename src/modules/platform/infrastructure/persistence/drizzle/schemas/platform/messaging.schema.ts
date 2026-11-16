// Re-export the kit's table declarations so Drizzle manages them in this service's migrations.
export {
  eventVersions,
  outboxEvents,
  processedEvents,
} from '@cadenway/nest-messaging/outbox/schema';
