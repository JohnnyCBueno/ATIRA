import { describe, expect, it, vi } from 'vitest';
import { captureFreshThenCached, LocationCaptureUnavailableError } from './locationCapture';

describe('bounded one-shot location capture', () => {
  it('uses a fresh point when it arrives before the deadline', async () => {
    const result = await captureFreshThenCached({
      getFresh: async () => 'fresh point',
      getCached: async () => 'cached point',
      timeoutMs: 50,
    });

    expect(result).toEqual({ value: 'fresh point', method: 'fresh' });
  });

  it('uses a cached point when the fresh request fails', async () => {
    const result = await captureFreshThenCached({
      getFresh: async () => { throw new Error('provider failed'); },
      getCached: async () => 'cached point',
      timeoutMs: 50,
    });

    expect(result).toEqual({ value: 'cached point', method: 'cached' });
  });

  it('times out instead of leaving the interface busy forever', async () => {
    vi.useFakeTimers();
    const result = captureFreshThenCached({
      getFresh: () => new Promise<string>(() => undefined),
      getCached: async () => null,
      timeoutMs: 12_000,
    });
    const rejection = expect(result).rejects.toBeInstanceOf(LocationCaptureUnavailableError);

    await vi.advanceTimersByTimeAsync(12_000);
    await rejection;
    vi.useRealTimers();
  });
});
