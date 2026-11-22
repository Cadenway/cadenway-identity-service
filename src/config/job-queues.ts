import type { JobQueueDeclaration } from '@cadenway/nest-jobs/provisioning';

/**
 * Constant ACCOUNT_DELETION_SWEEP_QUEUE
 *
 * @description
 * Queue of the sweep that enqueues the due deletions of accounts (`EnqueueDueAccountDeletions`).
 * Scheduled by `ACCOUNT_DELETION_SWEEP_CRON`; its jobs carry no payload.
 *
 * @type {string}
 */
export const ACCOUNT_DELETION_SWEEP_QUEUE: string = 'account.deletion-sweep';

/**
 * Constant ACCOUNT_DELETION_SWEEP_CRON
 *
 * @description
 * When the sweep runs: every 10 minutes, in UTC. An account is deleted within about 10 minutes of
 * its `deleteAt`, plus the 40 seconds pg-boss takes to evaluate a schedule and the poll of the
 * worker.
 *
 * @type {string}
 */
export const ACCOUNT_DELETION_SWEEP_CRON: string = '*/10 * * * *';

/**
 * Constant ACCOUNT_DELETION_QUEUE
 *
 * @description
 * Queue of the deletion of one account (`CompleteAccountDeletion`). One job per account and
 * occurrence, whose payload is the id of the account and whose occurrence key is that id and the
 * instant the deletion became due or was last checked, so the same check is never enqueued twice.
 *
 * @type {string}
 */
export const ACCOUNT_DELETION_QUEUE: string = 'account.delete';

/** System-only queue for removing expired realtime tickets. */
export const REALTIME_TICKET_EXPIRY_QUEUE: string = 'session.realtime-ticket-expiry';

/** Runs expiration every minute in UTC. */
export const REALTIME_TICKET_EXPIRY_CRON: string = '* * * * *';

/** System-only queue for retiring unused avatar reservations. */
export const AVATAR_UPLOAD_EXPIRY_QUEUE: string = 'account.avatar-upload-expiry';

/** Runs one bounded expiration sweep every minute in UTC. */
export const AVATAR_UPLOAD_EXPIRY_CRON: string = '* * * * *';

/** System-only queue for removing expired sign-in flows and SAML replay markers. */
export const FEDERATION_EXPIRY_QUEUE: string = 'account.federation-expiry';

/** Runs bounded federation retention every minute in UTC. */
export const FEDERATION_EXPIRY_CRON: string = '* * * * *';

/** System-only queue for removing inactive authentication counters. */
export const AUTHENTICATION_COUNTER_SWEEP_QUEUE: string = 'account.authentication-counter-sweep';

/** Runs bounded counter retention every minute in UTC. */
export const AUTHENTICATION_COUNTER_SWEEP_CRON: string = '* * * * *';

/**
 * Constant jobQueues
 *
 * @description
 * Every queue of this service, given as is to `provisionJobs` (`src/migrate.ts`, as the migrator
 * role) and to `JobsRuntimeModule` (`src/app.module.ts`, as the application role): a queue
 * missing from the database stops the start-up, and a changed declaration reaches the database at
 * the next migration run. Every payload holds ids only, never an address nor a secret.
 *
 * - `account.deletion-sweep` runs one short statement and the enqueues: two retries, a minute
 *   apart; a missed sweep is made up by the next one, 10 minutes later.
 * - `account.delete` deletes one account in one transaction: 5 retries with backoff from 30
 *   seconds, capped at 10 minutes, so the last attempt starts within about 30 minutes; an attempt
 *   is failed after 2 minutes. A job given up becomes a dead letter of
 *   `account.delete.dead-letter`, kept 14 days (see the MODULE.md of the accounts module for what an
 *   operator does with it). A job waits 1 day at most to start, and a finished one is kept 1 day:
 *   the occurrence key holds that long.
 * - `session.realtime-ticket-expiry` has two retries with backoff. The next sweep catches up
 *   because the expiry time on the ticket determines eligibility.
 * - `account.avatar-upload-expiry` takes up to 100 candidates per occurrence. Two retries cover
 *   transient failures, and a later sweep retries candidates without a committed decision.
 * - `account.federation-expiry` removes expired sign-in flows and replay markers in bounded batches
 *   with two retries for transient failures.
 * - `account.authentication-counter-sweep` removes inactive counters with two retries. A later
 *   sweep resumes any remaining rows.
 *
 * @type {readonly JobQueueDeclaration[]}
 */
export const jobQueues: readonly JobQueueDeclaration[] = [
  {
    name: AUTHENTICATION_COUNTER_SWEEP_QUEUE,
    retryLimit: 2,
    retryDelaySeconds: 10,
    retryBackoff: true,
    retryDelayMaxSeconds: 60,
    expireInSeconds: 120,
    retentionSeconds: 3_600,
    deleteAfterSeconds: 3_600,
    deadLetterRetentionSeconds: 86_400,
  },
  {
    name: ACCOUNT_DELETION_SWEEP_QUEUE,
    retryLimit: 2,
    retryDelaySeconds: 60,
    retryBackoff: false,
    expireInSeconds: 120,
    retentionSeconds: 3_600,
    deleteAfterSeconds: 3_600,
    deadLetterRetentionSeconds: 86_400,
  },
  {
    name: ACCOUNT_DELETION_QUEUE,
    retryLimit: 5,
    retryDelaySeconds: 30,
    retryBackoff: true,
    retryDelayMaxSeconds: 600,
    expireInSeconds: 120,
    retentionSeconds: 86_400,
    deleteAfterSeconds: 86_400,
    deadLetterRetentionSeconds: 1_209_600,
  },
  {
    name: REALTIME_TICKET_EXPIRY_QUEUE,
    retryLimit: 2,
    retryDelaySeconds: 10,
    retryBackoff: true,
    retryDelayMaxSeconds: 60,
    expireInSeconds: 120,
    retentionSeconds: 3_600,
    deleteAfterSeconds: 3_600,
    deadLetterRetentionSeconds: 86_400,
  },
  {
    name: AVATAR_UPLOAD_EXPIRY_QUEUE,
    retryLimit: 2,
    retryDelaySeconds: 10,
    retryBackoff: true,
    retryDelayMaxSeconds: 60,
    expireInSeconds: 120,
    retentionSeconds: 3_600,
    deleteAfterSeconds: 3_600,
    deadLetterRetentionSeconds: 86_400,
  },
  {
    name: FEDERATION_EXPIRY_QUEUE,
    retryLimit: 2,
    retryDelaySeconds: 10,
    retryBackoff: true,
    retryDelayMaxSeconds: 60,
    expireInSeconds: 120,
    retentionSeconds: 3_600,
    deleteAfterSeconds: 3_600,
    deadLetterRetentionSeconds: 86_400,
  },
];
