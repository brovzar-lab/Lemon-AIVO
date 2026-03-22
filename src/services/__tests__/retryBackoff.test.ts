import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff } from '../anthropic/retryBackoff';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns immediately on success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = retryWithBackoff(fn);
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a failing function up to maxRetries times with increasing delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success after retries');

    const onRetry = vi.fn();

    const resultPromise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      onRetry,
    });

    // First attempt fails, waits delay then retries
    await vi.advanceTimersByTimeAsync(2000);

    // Second attempt fails, waits longer delay then retries
    await vi.advanceTimersByTimeAsync(3000);

    const result = await resultPromise;

    expect(result).toBe('success after retries');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    // First retry: attempt 1, delay around 1000 + jitter
    expect(onRetry.mock.calls[0]![0]).toBe(1);
    // Second retry: attempt 2, delay around 2000 + jitter
    expect(onRetry.mock.calls[1]![0]).toBe(2);
  });

  it('throws after all retries exhausted', async () => {
    // Use real timers for this test to avoid unhandled rejection issues
    vi.useRealTimers();

    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelayMs: 10, // Very short delay for test speed
      })
    ).rejects.toThrow('persistent failure');

    // 1 initial + 2 retries = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);

    // Re-enable fake timers for remaining tests
    vi.useFakeTimers();
  });

  it('calls onRetry callback with attempt number and delay', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const onRetry = vi.fn();

    const resultPromise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      onRetry,
    });

    await vi.advanceTimersByTimeAsync(2000);

    await resultPromise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]![0]).toBe(1); // attempt number
    expect(typeof onRetry.mock.calls[0]![1]).toBe('number'); // delay in ms
    expect(onRetry.mock.calls[0]![1]).toBeGreaterThan(0); // positive delay
  });
});
