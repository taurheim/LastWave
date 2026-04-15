import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry, _resetRateLimitGate } from '@/core/fetchWithRetry';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetRateLimitGate();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns successful responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('ok', { status: 200 }),
    );

    const res = await fetchWithRetry('https://example.com');
    expect(res.status).toBe(200);
  });

  it('retries on 5xx and succeeds on second attempt', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('error', { status: 500, statusText: 'Server Error' }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const res = await fetchWithRetry('https://example.com');
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws on non-retryable 4xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(fetchWithRetry('https://example.com')).rejects.toThrow('404');
  });

  describe('429 rate limiting', () => {
    it('retries on 429 using X-RateLimit-Reset-In header', async () => {
      const headers429 = new Headers({
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset-In': '1',
      });

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('rate limited', { status: 429, statusText: 'Too Many Requests', headers: headers429 }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const res = await fetchWithRetry('https://example.com');
      expect(res.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting retries on persistent 429', async () => {
      const headers429 = new Headers({
        'X-RateLimit-Reset-In': '1',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('rate limited', { status: 429, statusText: 'Too Many Requests', headers: headers429 }),
      );

      await expect(fetchWithRetry('https://example.com', undefined, 2)).rejects.toThrow('429');
    });
  });

  describe('proactive throttling', () => {
    it('delays subsequent requests when X-RateLimit-Remaining is low', async () => {
      const lowRateHeaders = new Headers({
        'X-RateLimit-Remaining': '1',
        'X-RateLimit-Reset-In': '2',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('ok', { status: 200, headers: lowRateHeaders }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));

      // First call installs the gate
      await fetchWithRetry('https://example.com/1');

      // Second call should wait for the gate
      const startTime = Date.now();
      await fetchWithRetry('https://example.com/2');
      const elapsed = Date.now() - startTime;

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      // With fake timers + shouldAdvanceTime, the delay should have been applied
      expect(elapsed).toBeGreaterThanOrEqual(1500); // ~2000ms gate
    });
  });
});
