import type { Job, JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import { Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';

import type { PurgeExpiredRealtimeTickets } from '../../../../application/use-cases/commands/realtime-ticket/purge-expired-realtime-tickets/purge-expired-realtime-tickets.use-case.js';

/** Registers the durable expiration schedule and runs system-only ticket maintenance. */
export class RealtimeTicketExpiryHandler implements OnApplicationBootstrap {
  // #region Properties
  /** Reports the number of deleted rows without including credential data. */
  private readonly logger: Logger = new Logger(RealtimeTicketExpiryHandler.name);
  // #endregion

  // #region Constructor
  /** Binds the provisioned queue and schedule to the expiration sweep. */
  public constructor(
    private readonly scheduler: JobScheduler,
    private readonly workers: JobWorkerRegistry,
    private readonly purge: PurgeExpiredRealtimeTickets,
    private readonly queue: string,
    private readonly cron: string,
  ) {}
  // #endregion

  // #region Methods
  /** Upserts the same UTC schedule in each replica and registers its worker. */
  public async onApplicationBootstrap(): Promise<void> {
    await this.scheduler.schedule(this.queue, this.cron, { timeZone: 'UTC' });
    await this.workers.work(this.queue, (job: Job): Promise<void> => this.handle(job));
  }

  /** A failed attempt is retried by the queue and can resume after committed batches. */
  private async handle(job: Job): Promise<void> {
    if (job.organizationId !== null || job.payload !== null) {
      throw new Error('Realtime ticket expiry requires a system job without a payload.');
    }
    const deleted: number = await this.purge.execute(job.signal);
    if (deleted > 0) this.logger.log({ deleted }, 'expired realtime tickets removed');
  }
  // #endregion
}
