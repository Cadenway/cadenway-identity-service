import { describe, expect, it, vi } from 'vitest';

import { PurgeExpiredFederation } from './purge-expired-federation.use-case.js';

describe('PurgeExpiredFederation', () => {
  it('caps work per occurrence even if only the assertion table has a backlog', async () => {
    const deleteBatch = vi.fn().mockResolvedValue({ flows: 0, assertions: 250 });
    const sweep = new PurgeExpiredFederation({ deleteBatch });
    await expect(sweep.execute(new AbortController().signal)).resolves.toEqual({
      flows: 0,
      assertions: 1_000,
    });
    expect(deleteBatch.mock.calls).toEqual([[250], [250], [250], [250]]);
  });

  it('stops when both sources return partial batches', async () => {
    const deleteBatch = vi.fn().mockResolvedValue({ flows: 1, assertions: 2 });
    const sweep = new PurgeExpiredFederation({ deleteBatch });
    await expect(sweep.execute(new AbortController().signal)).resolves.toEqual({
      flows: 1,
      assertions: 2,
    });
    expect(deleteBatch).toHaveBeenCalledExactlyOnceWith(250);
  });

  it('does not start another transaction after the sweep is cancelled', async () => {
    const controller = new AbortController();
    const reason = new Error('The sweep was cancelled.');
    const deleteBatch = vi.fn(() => {
      controller.abort(reason);
      return Promise.resolve({ flows: 250, assertions: 0 });
    });
    const sweep = new PurgeExpiredFederation({ deleteBatch });
    await expect(sweep.execute(controller.signal)).rejects.toBe(reason);
    expect(deleteBatch).toHaveBeenCalledExactlyOnceWith(250);
  });
});
