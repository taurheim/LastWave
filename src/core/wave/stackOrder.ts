import type { Series } from 'd3-shape';

/**
 * Custom D3 stack order that places high-volume bands in the centre of the
 * streamgraph while remaining perfectly stable during progressive animation
 * (no band jumping when artists are added/removed between frames).
 *
 * How it works:
 *  1. Each series gets a score based solely on its own properties:
 *       score = peakCount  +  hashJitter
 *     Peak count is used because the animation threshold (`cleanByMinPlays`)
 *     filters by peak count — so newly-revealed artists always score lower
 *     than already-visible ones, guaranteeing they slot into edge positions
 *     without disturbing existing bands.
 *  2. Series are sorted by score (descending).
 *  3. Inside-out placement puts the highest-scoring (biggest) bands in the
 *     centre, alternating outward — the classic streamgraph layout.
 *
 * The hash-based jitter gives each artist a stable, deterministic tiebreaker
 * that adds organic variation among similarly-sized bands without depending
 * on what other artists are present.
 *
 * Complexity: O(n log n) — dominated by the sort.
 */

// Controls how much the per-key hash shuffles similarly-sized bands.
// 0 = pure peak ordering, 1 = pure hash ordering; 0.12 gives a natural
// organic feel while keeping big artists reliably central.
const DEFAULT_JITTER = 0.12;

// FNV-1a hash → normalised 0..1 float, seeded from the series key only.
function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

export function stackOrderSlopeBalanced(
  series: Series<Record<string, number>, string>[],
  jitterFraction: number = DEFAULT_JITTER,
): number[] {
  const n = series.length;
  if (n <= 1) return n === 1 ? [0] : [];

  // 1. Compute per-series peak count (matches cleanByMinPlays threshold).
  const peaks = new Float64Array(n);
  let maxPeak = 0;
  for (let j = 0; j < n; j++) {
    let pk = 0;
    for (let t = 0; t < series[j].length; t++) {
      const v = series[j][t][1];
      if (v > pk) pk = v;
    }
    peaks[j] = pk;
    if (pk > maxPeak) maxPeak = pk;
  }

  // 2. Score each series: blend of peak-based ordering and hash-based shuffle.
  //    Peaks are bucketed (log2) so that small frame-to-frame changes during
  //    the sweep animation don't cause bands to oscillate — artists only change
  //    relative order when their peak crosses a power-of-2 boundary.
  //    jitterFraction=0 → pure peak ordering (biggest in centre).
  //    jitterFraction=1 → pure hash ordering (deterministic but unrelated to size).
  const scored: { idx: number; score: number; key: string }[] = new Array(n);
  const jf = Math.max(0, Math.min(1, jitterFraction));
  for (let j = 0; j < n; j++) {
    const bucket = peaks[j] > 0 ? Math.floor(Math.log2(peaks[j])) : 0;
    const maxBucket = maxPeak > 0 ? Math.log2(maxPeak) : 1;
    const normBucket = maxBucket > 0 ? bucket / maxBucket : 0;
    const hash = hashKey(series[j].key);
    scored[j] = { idx: j, score: (1 - jf) * normBucket + jf * hash, key: series[j].key };
  }

  // Sort descending — highest score first (will go to the centre).
  // Key tiebreaker guarantees determinism regardless of input array order.
  scored.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  // 3. Centre-out placement: highest-scoring series go to the middle of the
  //    stack, then alternate outward so smaller bands end up at the edges.
  //    In a silhouette-offset streamgraph the centre is the most prominent.
  const order: number[] = new Array(n);
  const mid = n >> 1;
  // For even n, centre pair is (mid-1, mid); for odd n, centre is mid.
  let lo = n % 2 === 0 ? mid - 1 : mid;
  let hi = n % 2 === 0 ? mid : mid + 1;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0 && lo >= 0) {
      order[lo--] = scored[i].idx;
    } else if (hi < n) {
      order[hi++] = scored[i].idx;
    } else {
      order[lo--] = scored[i].idx;
    }
  }

  return order;
}
