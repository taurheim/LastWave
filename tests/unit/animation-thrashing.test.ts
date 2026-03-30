/**
 * Animation Thrashing Benchmark
 *
 * Simulates the full animation pipeline (sweep + buildup) on cached
 * last.fm data under different network conditions and measures
 * frame-to-frame visual stability.
 *
 * The simulation replicates exactly what LastWaveApp.tsx tick() does:
 *  - Phase 1 (Sweep): frontier advances left-to-right, capped by data arrival
 *  - Phase 2 (Buildup): threshold steps down, adding more artists
 *  - Final: full data with production jitter (0.15) for label render
 *
 * Network profiles model how segments arrive over time:
 *  - Fast (~150ms/batch): broadband — data arrives well within animation window
 *  - Slow (~500ms/batch): high-latency — data still arriving past frame budget
 *  - Variable (bursty): mobile — alternating fast/slow batches
 *
 * Metrics per frame transition:
 *  - Displacement: pixel-space band centroid shift (% of chart height)
 *  - Order changes: bands that swapped visual positions
 *  - Final jump: last-animation-frame → final-render displacement
 *  - Smoothness score: 0–100 composite (higher = smoother)
 *
 * Run:  npm run test:thrashing
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import * as fs from 'fs';
import * as path from 'path';
import { stackOrderSlopeBalanced } from '@/core/wave/stackOrder';
import { cleanByMinPlays, findOptimalMinPlays, getAnimationSteps } from '@/core/lastfm/util';
import type SeriesData from '@/core/models/SeriesData';

// ── Constants (match LastWaveApp.tsx / WaveVisualization.tsx) ────────
const RAMP_WIDTH = 5;
const MIN_ANIM_FRAMES = 50;
const HEIGHT = 550;
const ANIM_JITTER = 1.0; // pure hash ordering during animation
const FINAL_JITTER = 0.15; // production jitter for final render
const CONCURRENCY = 10; // MAX_CONCURRENT in LastWaveApp.tsx
const FRAME_INTERVAL_MS = 50; // MIN_ANIMATION_DURATION_MS / MIN_ANIM_FRAMES
const MAX_TICKS = 300; // safety cap (~15s wall time)

// ── Fixture loading ─────────────────────────────────────────────────
interface CachedData {
  username: string;
  numSegments: number;
  artists: { title: string; counts: number[] }[];
}

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/wave-accuracy');

const BENCHMARK_USERS = [
  'ewarsaba', // spec-mentioned (NIN/Aphex Twin thrashing)
  'grimmless', // complex data, many overflows
  'AlterMann', // complex data
  'w0rldprincess', // complex data
  'babydwake', // complex data
];

function loadFixtures(): CachedData[] {
  return BENCHMARK_USERS.map((name) => path.join(FIXTURE_DIR, `${name}.json`))
    .filter((f) => fs.existsSync(f))
    .map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
}

// ── Network profiles ────────────────────────────────────────────────

interface NetworkProfile {
  name: string;
  description: string;
  /** Frame number at which each segment index becomes available */
  arrivalFrames: number[];
}

function createProfile(
  name: string,
  description: string,
  numSegments: number,
  batchLatencyMs: (batchIndex: number) => number,
): NetworkProfile {
  const arrivalFrames: number[] = [];
  let timeMs = 0;
  for (let i = 0; i < numSegments; i += CONCURRENCY) {
    timeMs += batchLatencyMs(Math.floor(i / CONCURRENCY));
    const frame = Math.ceil(timeMs / FRAME_INTERVAL_MS);
    const batchSize = Math.min(CONCURRENCY, numSegments - i);
    for (let j = 0; j < batchSize; j++) {
      arrivalFrames.push(frame);
    }
  }
  return { name, description, arrivalFrames };
}

/** Broadband: ~150ms per batch, all data arrives by frame ~18 */
function fastProfile(n: number): NetworkProfile {
  return createProfile('Fast (~150ms)', 'Low-latency broadband', n, () => 150);
}

/** High-latency: ~500ms per batch, data still arriving past frame 50 */
function slowProfile(n: number): NetworkProfile {
  return createProfile(
    'Slow (~500ms)',
    'High-latency consistent (satellite/congested)',
    n,
    () => 500,
  );
}

/** Bursty: every 3rd batch takes 4× longer, simulating mobile jitter */
function variableProfile(n: number): NetworkProfile {
  return createProfile('Variable (bursty)', 'Mobile/unstable — alternating fast and slow', n, (
    batch,
  ) => (batch % 3 === 2 ? 800 : 200));
}

// Network profile helpers
function arrivedByFrame(profile: NetworkProfile, frame: number): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < profile.arrivalFrames.length; i++) {
    if (profile.arrivalFrames[i] <= frame) s.add(i);
  }
  return s;
}

function isAllArrived(profile: NetworkProfile, frame: number): boolean {
  return profile.arrivalFrames.every((f) => f <= frame);
}

function lastArrivedIdx(profile: NetworkProfile, frame: number): number {
  for (let i = profile.arrivalFrames.length - 1; i >= 0; i--) {
    if (profile.arrivalFrames[i] <= frame) return i;
  }
  return -1;
}

// ── Data helpers ────────────────────────────────────────────────────

/** Return artists with counts zeroed for unarrived segments */
function getPartialArtists(
  allArtists: SeriesData[],
  arrived: Set<number>,
): SeriesData[] {
  return allArtists
    .map((s) => ({
      title: s.title,
      counts: s.counts.map((c, i) => (arrived.has(i) ? c : 0)),
    }))
    .filter((s) => s.counts.some((c) => c > 0));
}

/** Apply the left-to-right frontier ramp mask */
function applyFrontierMask(artists: SeriesData[], frontier: number): SeriesData[] {
  return artists.map((s) => ({
    title: s.title,
    counts: s.counts.map((c, i) => {
      const scale = Math.max(0, Math.min(1, (frontier - i) / RAMP_WIDTH));
      return Math.round(c * scale);
    }),
  }));
}

// ── D3 stack computation ────────────────────────────────────────────

interface StackResult {
  stacked: d3.Series<Record<string, number>, string>[];
  yMin: number;
  yMax: number;
  keys: string[];
}

function computeStack(
  seriesData: SeriesData[],
  numSegments: number,
  jitter: number,
): StackResult {
  if (seriesData.length === 0) {
    return { stacked: [], yMin: 0, yMax: 0, keys: [] };
  }

  const keys = seriesData.map((s) => s.title);
  const tableData: Record<string, number>[] = [];
  for (let i = 0; i < numSegments; i++) {
    const row: Record<string, number> = { index: i };
    seriesData.forEach((s) => {
      row[s.title] = s.counts[i] ?? 0;
    });
    tableData.push(row);
  }

  const stack = d3
    .stack<Record<string, number>>()
    .keys(keys)
    .offset(d3.stackOffsetSilhouette)
    .order((s) => stackOrderSlopeBalanced(s, jitter));

  const stacked = stack(tableData);
  const yMin = d3.min(stacked, (layer) => d3.min(layer, (d) => d[0])) ?? 0;
  const yMax = d3.max(stacked, (layer) => d3.max(layer, (d) => d[1])) ?? 0;

  return { stacked, yMin, yMax, keys };
}

// ── Pixel-space centroids ───────────────────────────────────────────

function bandCentroids(
  stack: StackResult,
  numSegments: number,
): Map<string, Float64Array> {
  const { stacked, yMin, yMax } = stack;
  const yScale =
    yMin === yMax
      ? () => HEIGHT / 2
      : d3.scaleLinear().domain([yMin, yMax]).range([HEIGHT, 0]);

  const centroids = new Map<string, Float64Array>();
  for (const layer of stacked) {
    const c = new Float64Array(numSegments);
    for (let i = 0; i < numSegments; i++) {
      c[i] = (yScale(layer[i][0]) + yScale(layer[i][1])) / 2;
    }
    centroids.set(layer.key, c);
  }
  return centroids;
}

// ── Frame-to-frame displacement ─────────────────────────────────────

interface FrameDisplacement {
  meanDisplacementPct: number;
  maxDisplacementPct: number;
  commonBands: number;
  addedBands: number;
  removedBands: number;
  orderChanged: boolean;
}

function measureDisplacement(
  prev: Map<string, Float64Array>,
  curr: Map<string, Float64Array>,
  prevKeys: string[],
  currKeys: string[],
  numSegments: number,
): FrameDisplacement {
  const prevSet = new Set(prevKeys);
  const currSet = new Set(currKeys);
  const common = prevKeys.filter((k) => currSet.has(k));
  const added = currKeys.filter((k) => !prevSet.has(k));
  const removed = prevKeys.filter((k) => !currSet.has(k));

  let totalDisp = 0;
  let maxDisp = 0;
  let count = 0;

  for (const key of common) {
    const prevC = prev.get(key)!;
    const currC = curr.get(key)!;
    for (let i = 0; i < numSegments; i++) {
      const d = Math.abs(prevC[i] - currC[i]);
      totalDisp += d;
      if (d > maxDisp) maxDisp = d;
      count++;
    }
  }

  const meanDisp = count > 0 ? totalDisp / count : 0;

  // Check visual order stability at the middle segment
  const mid = Math.floor(numSegments / 2);
  let orderChanged = false;
  if (common.length >= 2) {
    const prevOrder = common
      .map((k) => ({ key: k, y: prev.get(k)![mid] }))
      .sort((a, b) => a.y - b.y)
      .map((x) => x.key);
    const currOrder = common
      .map((k) => ({ key: k, y: curr.get(k)![mid] }))
      .sort((a, b) => a.y - b.y)
      .map((x) => x.key);
    orderChanged = prevOrder.some((k, i) => k !== currOrder[i]);
  }

  return {
    meanDisplacementPct: (meanDisp / HEIGHT) * 100,
    maxDisplacementPct: (maxDisp / HEIGHT) * 100,
    commonBands: common.length,
    addedBands: added.length,
    removedBands: removed.length,
    orderChanged,
  };
}

// ── Animation simulation ────────────────────────────────────────────
// Replicates the exact tick() loop from LastWaveApp.tsx

interface AnimFrame {
  phase: 'sweep' | 'buildup' | 'final';
  frameIndex: number;
  frontier: number;
  threshold: number;
  bandCount: number;
  stack: StackResult;
}

interface SimResult {
  frames: AnimFrame[];
  totalTicks: number;
  stalledTicks: number;
}

function simulateAnimation(data: CachedData, profile: NetworkProfile): SimResult {
  const numSeg = data.numSegments;
  const artists: SeriesData[] = data.artists;
  const frames: AnimFrame[] = [];
  const frontierEnd = numSeg + RAMP_WIDTH;

  let frontier = 0;
  let frameCount = 0; // rendered frames only (matches animFrameCountRef)
  let tickCount = 0;
  let stalledTicks = 0;
  let sweepThreshold: number | null = null;
  let buildupSteps: number[] = [];
  let sweepDone = false;

  while (tickCount < MAX_TICKS) {
    tickCount++;
    const arrived = arrivedByFrame(profile, tickCount);
    const hasData = arrived.size > 0;
    const allHere = isAllArrived(profile, tickCount);

    let rendered = false;

    if (!sweepDone) {
      if (hasData) {
        // Compute sweep threshold once from unmasked partial data
        // (matches renderStreamFrame's Infinity check)
        if (sweepThreshold === null) {
          const partial = getPartialArtists(artists, arrived);
          const arrCount = arrived.size;
          const pmp = findOptimalMinPlays(partial, 30);
          const predicted = Math.max(5, Math.round(pmp * Math.sqrt(numSeg / arrCount)));
          sweepThreshold = predicted * 3;
        }

        // Advance frontier (exact logic from tick())
        const framesLeft = Math.max(MIN_ANIM_FRAMES - frameCount, 1);
        const revealFrames = Math.max(Math.ceil(framesLeft / 2), 1);
        const remaining = frontierEnd - frontier;
        const advance = Math.max(1, remaining / revealFrames);
        const lastArr = lastArrivedIdx(profile, tickCount);
        const maxFront = lastArr + 1 + RAMP_WIDTH;
        frontier = Math.min(frontier + advance, maxFront, frontierEnd);

        // Render: partial data → frontier mask → threshold filter → stack
        const partial = getPartialArtists(artists, arrived);
        const masked = applyFrontierMask(partial, frontier);
        const cleaned = cleanByMinPlays(masked, sweepThreshold);
        const stack = computeStack(cleaned, numSeg, ANIM_JITTER);

        frames.push({
          phase: 'sweep',
          frameIndex: frameCount,
          frontier,
          threshold: sweepThreshold,
          bandCount: cleaned.length,
          stack,
        });
        rendered = true;

        // Sweep just completed? Compute buildup steps.
        if (frontier >= frontierEnd) {
          sweepDone = true;
          const buildupData = getPartialArtists(artists, arrived);
          const omp = findOptimalMinPlays(buildupData, 30);
          const rf = Math.max(MIN_ANIM_FRAMES - frameCount, 4);
          buildupSteps = getAnimationSteps(buildupData, omp, 3, rf).filter(
            (s) => s < sweepThreshold!,
          );
        }
      } else {
        stalledTicks++;
      }
    } else if (buildupSteps.length > 0) {
      // Buildup: re-join latest available data (new segments may have arrived)
      const step = buildupSteps.shift()!;
      const partial = getPartialArtists(artists, arrived);
      const cleaned = cleanByMinPlays(partial, step);
      const stack = computeStack(cleaned, numSeg, ANIM_JITTER);

      frames.push({
        phase: 'buildup',
        frameIndex: frameCount,
        frontier: frontierEnd,
        threshold: step,
        bandCount: cleaned.length,
        stack,
      });
      rendered = true;
    } else if (!allHere) {
      // Waiting for remaining data to arrive
      stalledTicks++;
    }

    if (rendered) frameCount++;

    if (sweepDone && buildupSteps.length === 0 && allHere) break;
  }

  // Final render: full data, production jitter
  const omp = findOptimalMinPlays(artists, 30);
  const finalData = cleanByMinPlays(artists, omp);
  const finalStack = computeStack(finalData, numSeg, FINAL_JITTER);

  frames.push({
    phase: 'final',
    frameIndex: frameCount,
    frontier: frontierEnd,
    threshold: omp,
    bandCount: finalData.length,
    stack: finalStack,
  });

  return { frames, totalTicks: tickCount, stalledTicks };
}

// ── Benchmark orchestration ─────────────────────────────────────────

interface BenchmarkResult {
  username: string;
  totalFrames: number;
  sweepFrames: number;
  buildupFrames: number;
  stalledTicks: number;
  sweepMeanPct: number;
  sweepMaxPct: number;
  sweepOrderChanges: number;
  buildupMeanPct: number;
  buildupMaxPct: number;
  buildupOrderChanges: number;
  finalJumpPct: number;
  finalOrderChanged: boolean;
  overallMeanPct: number;
  overallMaxPct: number;
  overallP95Pct: number;
  totalOrderChanges: number;
  smoothnessScore: number;
}

function runBenchmark(data: CachedData, profile: NetworkProfile): BenchmarkResult {
  const { frames, stalledTicks } = simulateAnimation(data, profile);
  const numSeg = data.numSegments;

  const centroids = frames.map((f) => bandCentroids(f.stack, numSeg));

  const displacements: FrameDisplacement[] = [];
  for (let i = 1; i < frames.length; i++) {
    displacements.push(
      measureDisplacement(
        centroids[i - 1],
        centroids[i],
        frames[i - 1].stack.keys,
        frames[i].stack.keys,
        numSeg,
      ),
    );
  }

  // Categorize by phase (displacement[i] = transition INTO frame i+1)
  const sweepDisps = displacements.filter((_, i) => frames[i + 1].phase === 'sweep');
  const buildupDisps = displacements.filter((_, i) => frames[i + 1].phase === 'buildup');
  const finalDisp = displacements.length > 0 ? displacements[displacements.length - 1] : null;

  const mean = (a: number[]) => (a.length > 0 ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const max = (a: number[]) => (a.length > 0 ? Math.max(...a) : 0);
  const p95 = (a: number[]) => {
    if (a.length === 0) return 0;
    const sorted = [...a].sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length * 0.95)];
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const allMaxDisps = displacements.map((d) => d.maxDisplacementPct);

  // Smoothness score: penalize large frame-to-frame jumps
  let penalty = 0;
  for (const d of displacements) {
    if (d.maxDisplacementPct > 5) penalty += d.maxDisplacementPct * 2;
    else if (d.maxDisplacementPct > 1) penalty += d.maxDisplacementPct;
  }
  const maxPenalty = displacements.length * 20;
  const smoothnessScore = Math.max(0, Math.round(100 * (1 - penalty / maxPenalty) * 10) / 10);

  return {
    username: data.username,
    totalFrames: frames.length,
    sweepFrames: frames.filter((f) => f.phase === 'sweep').length,
    buildupFrames: frames.filter((f) => f.phase === 'buildup').length,
    stalledTicks,
    sweepMeanPct: r2(mean(sweepDisps.map((d) => d.meanDisplacementPct))),
    sweepMaxPct: r2(max(sweepDisps.map((d) => d.maxDisplacementPct))),
    sweepOrderChanges: sweepDisps.filter((d) => d.orderChanged).length,
    buildupMeanPct: r2(mean(buildupDisps.map((d) => d.meanDisplacementPct))),
    buildupMaxPct: r2(max(buildupDisps.map((d) => d.maxDisplacementPct))),
    buildupOrderChanges: buildupDisps.filter((d) => d.orderChanged).length,
    finalJumpPct: finalDisp ? r2(finalDisp.maxDisplacementPct) : 0,
    finalOrderChanged: finalDisp?.orderChanged ?? false,
    overallMeanPct: r2(mean(displacements.map((d) => d.meanDisplacementPct))),
    overallMaxPct: r2(max(allMaxDisps)),
    overallP95Pct: r2(p95(allMaxDisps)),
    totalOrderChanges: displacements.filter((d) => d.orderChanged).length,
    smoothnessScore,
  };
}

// ── Pretty-print ────────────────────────────────────────────────────

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function rpad(s: string, n: number) {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function printSummary(profileName: string, results: BenchmarkResult[]) {
  const sep =
    '┌────────────────┬────────┬─────────┬──────────────────────┬──────────────────────┬───────────┬──────────┬───────┐';
  const hdr =
    '│ User           │ Frames │ Stalled │   Sweep (mean/max %) │ Buildup (mean/max %) │ Final Jmp │ Ord Chgs │ Score │';
  const mid =
    '├────────────────┼────────┼─────────┼──────────────────────┼──────────────────────┼───────────┼──────────┼───────┤';
  const bot =
    '└────────────────┴────────┴─────────┴──────────────────────┴──────────────────────┴───────────┴──────────┴───────┘';

  console.log(`\n  ${profileName}`);
  console.log(
    '  Displacement = band centroid shift between consecutive frames (% of chart height)\n',
  );
  console.log(`  ${sep}`);
  console.log(`  ${hdr}`);
  console.log(`  ${mid}`);

  for (const r of results) {
    const user = pad(r.username, 14);
    const frames = rpad(String(r.totalFrames), 6);
    const stalled = rpad(String(r.stalledTicks), 7);
    const sweep = pad(`${r.sweepMeanPct}  / ${r.sweepMaxPct}`, 20);
    const buildup = pad(`${r.buildupMeanPct}  / ${r.buildupMaxPct}`, 20);
    const fj = rpad(r.finalJumpPct.toFixed(2), 9);
    const ord = rpad(String(r.totalOrderChanges), 8);
    const score = rpad(r.smoothnessScore.toFixed(1), 5);
    console.log(
      `  │ ${user} │ ${frames} │ ${stalled} │ ${sweep} │ ${buildup} │ ${fj} │ ${ord} │ ${score} │`,
    );
  }

  console.log(`  ${bot}`);

  const avgScore = results.reduce((a, r) => a + r.smoothnessScore, 0) / results.length;
  const worstMax = Math.max(...results.map((r) => r.overallMaxPct));
  const avgMean = results.reduce((a, r) => a + r.overallMeanPct, 0) / results.length;
  console.log(`\n  Avg score: ${avgScore.toFixed(1)}/100`);
  console.log(`  Avg mean displacement: ${avgMean.toFixed(2)}%`);
  console.log(`  Worst max displacement: ${worstMax.toFixed(2)}%`);
  console.log(
    `  Total order changes: ${results.reduce((a, r) => a + r.totalOrderChanges, 0)}`,
  );
  console.log();
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Animation Thrashing Benchmark', () => {
  const fixtures = loadFixtures();

  it('has fixture data available', () => {
    expect(fixtures.length).toBeGreaterThan(0);
    for (const f of fixtures) {
      expect(f.artists.length).toBeGreaterThan(0);
      expect(f.numSegments).toBeGreaterThan(0);
    }
  });

  // ── Fast network ────────────────────────────────────────────────
  describe('Fast network (~150ms latency)', () => {
    const results: BenchmarkResult[] = [];

    for (const fixture of fixtures) {
      it(`benchmarks ${fixture.username}`, () => {
        const profile = fastProfile(fixture.numSegments);
        const result = runBenchmark(fixture, profile);
        results.push(result);

        expect(result.totalFrames).toBeGreaterThan(10);
        expect(result.smoothnessScore).toBeGreaterThanOrEqual(0);
        expect(result.smoothnessScore).toBeLessThanOrEqual(100);

        console.log(
          `    ${fixture.username}: ` +
            `${result.totalFrames} frames (${result.sweepFrames}S+${result.buildupFrames}B+1F), ` +
            `stalled ${result.stalledTicks}, ` +
            `mean ${result.overallMeanPct}%, max ${result.overallMaxPct}%, ` +
            `final ${result.finalJumpPct}%, ` +
            `ord ${result.totalOrderChanges}, ` +
            `score ${result.smoothnessScore}`,
        );
      });
    }

    it('summary', () => {
      expect(results.length).toBe(fixtures.length);
      printSummary('Fast Network (~150ms/batch, 10 concurrent)', results);
    });
  });

  // ── Slow consistent network ─────────────────────────────────────
  describe('Slow consistent network (~500ms latency)', () => {
    const results: BenchmarkResult[] = [];

    for (const fixture of fixtures) {
      it(`benchmarks ${fixture.username}`, () => {
        const profile = slowProfile(fixture.numSegments);
        const result = runBenchmark(fixture, profile);
        results.push(result);

        expect(result.totalFrames).toBeGreaterThan(5);
        expect(result.smoothnessScore).toBeGreaterThanOrEqual(0);
        expect(result.smoothnessScore).toBeLessThanOrEqual(100);

        console.log(
          `    ${fixture.username}: ` +
            `${result.totalFrames} frames (${result.sweepFrames}S+${result.buildupFrames}B+1F), ` +
            `stalled ${result.stalledTicks}, ` +
            `mean ${result.overallMeanPct}%, max ${result.overallMaxPct}%, ` +
            `final ${result.finalJumpPct}%, ` +
            `ord ${result.totalOrderChanges}, ` +
            `score ${result.smoothnessScore}`,
        );
      });
    }

    it('summary', () => {
      expect(results.length).toBe(fixtures.length);
      printSummary('Slow Consistent Network (~500ms/batch, 10 concurrent)', results);
    });
  });

  // ── Variable latency network ────────────────────────────────────
  describe('Variable latency network (bursty)', () => {
    const results: BenchmarkResult[] = [];

    for (const fixture of fixtures) {
      it(`benchmarks ${fixture.username}`, () => {
        const profile = variableProfile(fixture.numSegments);
        const result = runBenchmark(fixture, profile);
        results.push(result);

        expect(result.totalFrames).toBeGreaterThan(5);
        expect(result.smoothnessScore).toBeGreaterThanOrEqual(0);
        expect(result.smoothnessScore).toBeLessThanOrEqual(100);

        console.log(
          `    ${fixture.username}: ` +
            `${result.totalFrames} frames (${result.sweepFrames}S+${result.buildupFrames}B+1F), ` +
            `stalled ${result.stalledTicks}, ` +
            `mean ${result.overallMeanPct}%, max ${result.overallMaxPct}%, ` +
            `final ${result.finalJumpPct}%, ` +
            `ord ${result.totalOrderChanges}, ` +
            `score ${result.smoothnessScore}`,
        );
      });
    }

    it('summary', () => {
      expect(results.length).toBe(fixtures.length);
      printSummary('Variable Latency Network (bursty, 10 concurrent)', results);
    });
  });
});
