/**
 * Fetch wrapper with retry logic and response validation.
 * Retries on network errors and 5xx responses with exponential backoff.
 */

const DEFAULT_RETRIES = 3;
const BASE_DELAY_MS = 1000;

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

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = DEFAULT_RETRIES,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);

      if (response.ok) return response;

      if (isRetryable(response.status) && attempt < maxRetries - 1) {
        lastError = new FetchError(
          `Server error ${response.status}: ${response.statusText}`,
          response.status,
        );
        await delay(BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      // 4xx or final 5xx attempt — don't retry
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
