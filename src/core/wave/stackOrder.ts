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
 *  3. Placement uses one of two strategies:
 *     - Animation mode (stable slots): each artist's position depends only on
 *       its own score and hash, so adding/removing artists shifts at most one
 *       adjacent neighbour.
 *     - Standard mode (inside-out): highest-scoring bands go to the centre,
 *       alternating outward — the classic streamgraph layout.
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

// Hard ceiling on effective jitter — values above this are clamped so animation
// frames produce orderings identical to the production default (0.15).
const MAX_EFFECTIVE_JITTER = 0.15;

// Jitter values above this threshold use stable slot placement instead of
// classic inside-out. Set to -1 to always use stable placement.
const STABLE_PLACEMENT_THRESHOLD = -1;

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
  //    Peaks are bucketed (log2) and divided by BUCKET_DIVISOR for coarser
  //    grouping, then normalised against BUCKET_NORMALIZER (a fixed constant)
  //    instead of a data-dependent maximum. This guarantees that a series'
  //    score depends only on its own peak — not on the current dataset — so
  //    adding or removing other artists cannot re-rank existing ones.
  //    jitterFraction is clamped to MAX_EFFECTIVE_JITTER so animation frames
  //    produce orderings identical to the production default.
  const scored: { idx: number; score: number; key: string; hash: number }[] = new Array(n);
  const jf = Math.max(0, Math.min(MAX_EFFECTIVE_JITTER, jitterFraction));
  const BUCKET_NORMALIZER = 20; // fixed: supports peaks up to 2^20 ≈ 1M
  const BUCKET_DIVISOR = 3;     // coarser buckets → fewer boundary crossings during sweep
  for (let j = 0; j < n; j++) {
    const bucket = peaks[j] > 0 ? Math.floor(Math.log2(peaks[j]) / BUCKET_DIVISOR) : 0;
    const normBucket = bucket / BUCKET_NORMALIZER;
    const hash = hashKey(series[j].key);
    scored[j] = { idx: j, score: (1 - jf) * normBucket + jf * hash, key: series[j].key, hash };
  }

  // Sort descending — highest score first (will go to the centre).
  // Key tiebreaker guarantees determinism regardless of input array order.
  scored.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  // 3. Placement — two strategies:
  //
  //    Animation mode (jitterFraction > STABLE_PLACEMENT_THRESHOLD):
  //      Stable slot-based placement. Each artist's position is a function of
  //      its own score and hash only, so adding/removing artists shifts at most
  //      one adjacent neighbour. This caps per-frame displacement.
  //
  //    Standard mode: classic inside-out interleaving — biggest in the centre,
  //      alternating outward. The traditional streamgraph look.

  if (jitterFraction > STABLE_PLACEMENT_THRESHOLD) {
    const withTarget = scored.map((s) => {
      const dist = (1 - s.score) * 0.5;
      const target = s.hash < 0.5
        ? 0.5 - dist
        : 0.5 + dist;
      return { idx: s.idx, target, key: s.key };
    });
    withTarget.sort((a, b) => a.target - b.target || a.key.localeCompare(b.key));
    return withTarget.map((s) => s.idx);
  }

  // Classic centre-out interleaving (final render path).
  const order: number[] = new Array(n);
  const mid = n >> 1;
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
