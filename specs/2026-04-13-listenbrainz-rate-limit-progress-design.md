# ListenBrainz Rate Limiting & Sub-Segment Progress

## Problem

ListenBrainz's listens API paginates (max 1000 listens per request), so fetching a single weekly segment for a very active listener may require multiple sequential HTTP requests. This causes two problems:

1. **429 rate limiting** — The rate limit is 30 requests per ~10-second window. With 10 concurrent segment workers, we can exceed this. `fetchWithRetry` doesn't handle 429 at all (only retries 5xx).
2. **Frozen progress** — The `pooled()` function only reports progress when an entire segment completes. During pagination, the loading bar and streaming animation stall.

**Key finding:** The API accepts `count=1000` (not just 100 as we had). Bumping the page size from 100→1000 means most weekly segments need only 1 request, drastically reducing both the rate limit pressure and the pagination progress issue. But we still need rate limit handling as a safety net for heavy listeners or long time ranges.

## Design

### 0. Bump Page Size (100 → 1000)

`LISTENS_PAGE_SIZE` in `ListenBrainzApi.ts` goes from 100 to 1000. The API's `MAX_ITEMS_PER_GET` is 1000. This alone reduces requests ~10x for most users.

### 1. Rate-Limit-Aware Fetch (`fetchWithRetry`)

Extend `fetchWithRetry` to handle rate limiting both proactively and reactively:

- **Proactive throttling:** After every response, read `X-RateLimit-Remaining` and `X-RateLimit-Reset-In` headers. When `Remaining` is low (≤2), sleep for `Reset-In` seconds before the next request.
- **Reactive 429 handling:** Add 429 as a retryable status code. On 429, read `X-RateLimit-Reset-In` (or fall back to exponential backoff) and sleep before retrying.

This is generic infrastructure — all API calls benefit, not just ListenBrainz.

### 2. Sub-Segment Progress via DataSource Interface

Add an optional `onSubProgress` callback to `DataSource.fetchSegment`:

```typescript
export interface DataSource {
  fetchSegment(
    username: string,
    method: string,
    from: number,
    to: number,
    onSubProgress?: (subText: string) => void,
  ): Promise<SegmentData[]>;
}
```

- **ListenBrainzDataSource** passes it through to `aggregateListens`, which calls `onSubProgress('page 2')` after each pagination request.
- **LastFmDataSource** ignores it (single request per segment).
- **Caller in LastWaveApp** wires it to `store.setStageSubText()` so the UI shows `Loading weeks 3/13 (page 2)…`.

### 3. Wire Into `pooled()`

Extend `pooled()` to pass a per-task sub-progress callback:

```typescript
async function pooled<T>(
  tasks: ((onSubProgress?: (text: string) => void) => Promise<T>)[],
  concurrency: number,
  onProgress?: () => void,
  onResult?: (index: number, result: T) => void,
): Promise<T[]>
```

Each task receives its own `onSubProgress` that the caller can wire to `setStageSubText`. The segment tasks in `LastWaveApp` pass this through to `dataSource.fetchSegment`.

### 4. Loading Text Format

During ListenBrainz pagination: `Loading weeks 3/13 (page 2)…`

This matches the existing pattern where the genre stage shows `Loading genres 5/30 (Radiohead)…`.

## Scope

### In scope
- 429 handling + proactive rate limiting in `fetchWithRetry`
- `onSubProgress` callback on `DataSource.fetchSegment` interface
- ListenBrainz pagination progress reporting
- Updated `pooled()` signature to support per-task sub-progress
- Tests for rate limiting and progress callbacks

### Out of scope
- Refactoring genre lookup to use the same `DataSource` interface (different shape — genres aren't segments)
- Changing `MAX_CONCURRENT` (already at 10, rate limiting will naturally throttle)
- Authentication token support for higher rate limits

## Acceptance Criteria

1. No 429 errors during a typical 3-month weekly ListenBrainz load
2. Loading text updates within each segment showing page progress
3. Last.fm path is unaffected (no regressions)
4. All existing tests pass; new tests cover 429 handling and sub-progress
