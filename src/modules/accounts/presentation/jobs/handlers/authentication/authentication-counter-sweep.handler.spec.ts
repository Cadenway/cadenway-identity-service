import type { JobScheduler, JobWorkerRegistry } from '@cadenway/nest-jobs/runtime';
import { describe, expect, it, vi } from 'vitest';

import { PurgeInactiveAuthenticationCounters } from '../../../../application/use-cases/commands/authentication/purge-inactive-authentication-counters/purge-inactive-authentication-counters.use-case.js';
import { AuthenticationCounterSweepHandler } from './authentication-counter-sweep.handler.js';

describe('AuthenticationCounterSweepHandler', () => {
  it.each([false, true])(
    'keeps scheduling and worker activation behind the rollout setting (%s)',
    async (enabled) => {
      const schedule = vi.fn<JobScheduler['schedule']>().mockResolvedValue(undefined);
      const unschedule = vi.fn<JobScheduler['unschedule']>().mockResolvedValue(undefined);
      const work = vi.fn<JobWorkerRegistry['work']>().mockResolvedValue(undefined);
      const purge = new PurgeInactiveAuthenticationCounters({
        deleteBatch: () => Promise.resolve(0),
      });
      const queue = 'account.authentication-counter-sweep';
      const cron = '* * * * *';
      const handler = new AuthenticationCounterSweepHandler(
        { schedule, unschedule },
        { work },
        purge,
        queue,
        cron,
        enabled,
      );

      await handler.onApplicationBootstrap();

      if (enabled) {
        expect(schedule).toHaveBeenCalledWith(queue, cron, { timeZone: 'UTC' });
        expect(unschedule).not.toHaveBeenCalled();
        expect(work).toHaveBeenCalledWith(queue, expect.any(Function));
      } else {
        expect(schedule).not.toHaveBeenCalled();
        expect(unschedule).toHaveBeenCalledWith(queue);
        expect(work).not.toHaveBeenCalled();
      }
    },
  );
});
