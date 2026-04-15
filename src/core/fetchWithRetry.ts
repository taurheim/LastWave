/**
 * Fetch wrapper with retry logic, response validation, and rate-limit awareness.
 * Retries on network errors, 5xx responses (exponential backoff), and 429
 * responses (respects X-RateLimit-Reset-In header).  Proactively throttles
 * when X-RateLimit-Remaining is low to avoid hitting 429 in the first place.
 */

const DEFAULT_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RATE_LIMIT_HEADROOM = 2;

/** Shared proactive-throttle state: resolves when the current window resets. */
let rateLimitGate: Promise<void> | null = null;

function isRetryable(status: number): boolean {
  return status >= 500 && status < 600;
}

class FetchError extends Error {
  public status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}

/**
 * Read rate-limit headers and, if the remaining budget is nearly exhausted,
 * install a shared gate that forces all subsequent callers to wait until the
 * window resets.
 */
function applyProactiveThrottle(response: Response): void {
  const remaining = Number(response.headers?.get('X-RateLimit-Remaining'));
  const resetIn = Number(response.headers?.get('X-RateLimit-Reset-In'));
  if (Number.isFinite(remaining) && remaining <= RATE_LIMIT_HEADROOM && resetIn > 0) {
    if (!rateLimitGate) {
      rateLimitGate = delay(resetIn * 1000).then(() => {
        rateLimitGate = null;
      });
    }
  }
}

function getRateLimitDelay(response: Response): number {
  const resetIn = Number(response.headers?.get('X-RateLimit-Reset-In'));
  return Number.isFinite(resetIn) && resetIn > 0 ? resetIn * 1000 : 0;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = DEFAULT_RETRIES,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Wait for any proactive rate-limit gate before sending a request
    if (rateLimitGate) await rateLimitGate;

    try {
      const response = await fetch(input, init);

      // Proactive throttle: if remaining budget is low, gate future requests
      applyProactiveThrottle(response);

      if (response.ok) return response;

      // 429 Too Many Requests — sleep and retry
      if (response.status === 429 && attempt < maxRetries - 1) {
        const retryDelay = getRateLimitDelay(response) || BASE_DELAY_MS * 2 ** attempt;
        lastError = new FetchError('Rate limited (429)', 429);
        await delay(retryDelay);
        continue;
      }

      if (isRetryable(response.status) && attempt < maxRetries - 1) {
        lastError = new FetchError(
          `Server error ${response.status}: ${response.statusText}`,
          response.status,
        );
        await delay(BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      // Non-retryable 4xx or final attempt — throw
      throw new FetchError(
        `Request failed (${response.status}): ${response.statusText}`,
        response.status,
      );
    } catch (err) {
      if (err instanceof FetchError) throw err;

      // Network error — retry if attempts remain
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        await delay(BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
    }
  }

  throw lastError ?? new Error('Fetch failed after retries');
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Reset the shared rate-limit gate (used in tests). */
export function _resetRateLimitGate(): void {
  rateLimitGate = null;
}
