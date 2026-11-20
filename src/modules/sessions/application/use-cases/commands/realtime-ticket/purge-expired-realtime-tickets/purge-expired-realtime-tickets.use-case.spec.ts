import { describe, expect, it, vi } from 'vitest';

import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { ExpiredRealtimeTicketsUnitOfWork } from '../../../../ports/outbound/transactions/realtime-ticket/expired-realtime-tickets-unit-of-work.port.js';
import { PurgeExpiredRealtimeTickets } from './purge-expired-realtime-tickets.use-case.js';

describe('PurgeExpiredRealtimeTickets', () => {
  it('uses the original cutoff for every bounded batch, including while new tickets expire', async () => {
    const cutoff: Date = new Date('2026-11-20T15:27:00Z');
    const now = vi
      .fn<Clock['now']>()
      .mockReturnValueOnce(cutoff)
      .mockReturnValue(new Date('2026-11-20T15:28:00Z'));
    const deleteBatch = vi
      .fn<ExpiredRealtimeTicketsUnitOfWork['deleteBatch']>()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(15);
    const purge: PurgeExpiredRealtimeTickets = new PurgeExpiredRealtimeTickets(
      { deleteBatch },
      { now },
    );

    await expect(purge.execute(new AbortController().signal)).resolves.toBe(215);
    expect(deleteBatch.mock.calls).toEqual([
      [cutoff, 100],
      [cutoff, 100],
      [cutoff, 100],
    ]);
    expect(now).toHaveBeenCalledOnce();
  });

  it('does not start a transaction when the attempt is already cancelled', async () => {
    const stop: AbortController = new AbortController();
    const deleteBatch = vi.fn<ExpiredRealtimeTicketsUnitOfWork['deleteBatch']>();
    const purge: PurgeExpiredRealtimeTickets = new PurgeExpiredRealtimeTickets(
      { deleteBatch },
      { now: (): Date => new Date('2026-11-20T15:27:00Z') },
    );
    stop.abort();

    await expect(purge.execute(stop.signal)).rejects.toThrow();
    expect(deleteBatch).not.toHaveBeenCalled();
  });

  it('stops before opening another transaction when cancelled during a full batch', async () => {
    const stop: AbortController = new AbortController();
    const deleteBatch = vi
      .fn<ExpiredRealtimeTicketsUnitOfWork['deleteBatch']>()
      .mockImplementation((): Promise<number> => {
        stop.abort();
        return Promise.resolve(100);
      });
    const purge: PurgeExpiredRealtimeTickets = new PurgeExpiredRealtimeTickets(
      { deleteBatch },
      { now: (): Date => new Date('2026-11-20T15:27:00Z') },
    );

    await expect(purge.execute(stop.signal)).rejects.toThrow();
    expect(deleteBatch).toHaveBeenCalledOnce();
  });
});
