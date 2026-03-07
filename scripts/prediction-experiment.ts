/**
 * Prediction Experiment: tests algorithms for predicting final minPlays
 * from partial segment data (simulating early network arrivals).
 *
 * Run: npx tsx scripts/prediction-experiment.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findOptimalMinPlays, joinSegments } from '../src/core/lastfm/util.js';
import SegmentData from '../src/core/models/SegmentData.js';
import type SeriesData from '../src/core/models/SeriesData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Types ──────────────────────────────────────────────────────────────

interface CachedUser {
  username: string;
  numSegments: number;
  artists: { title: string; counts: number[] }[];
}

interface TrialResult {
  algorithm: string;
  k: number;
  prediction: number;
  truth: number;
  error: number;        // signed
  absError: number;
  pctError: number;     // signed %
}

interface AlgorithmMetrics {
  algorithm: string;
  k: number;
  mae: number;
  medianAE: number;
  meanPctError: number;
  within20pct: number;
  within50pct: number;
  meanSignedError: number;
  n: number;
}

// ── Data Loading ───────────────────────────────────────────────────────

function loadUsers(): CachedUser[] {
  const users: CachedUser[] = [];
  const dirs = [
    path.resolve(__dirname, '..', 'tests', 'fixtures', 'wave-accuracy'),
    path.resolve(__dirname, '..', 'tests', 'fixtures', 'wave-prediction'),
  ];
  const seen = new Set<string>();

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      if (seen.has(file)) continue;
      seen.add(file);
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      users.push(raw as CachedUser);
    }
  }
  return users;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Build the full (SegmentData[] | undefined)[] for a user. */
function buildFullSegments(user: CachedUser): SegmentData[][] {
  const segments: SegmentData[][] = [];
  for (let i = 0; i < user.numSegments; i++) {
    const seg: SegmentData[] = [];
    for (const artist of user.artists) {
      if (artist.counts[i] > 0) {
        seg.push(new SegmentData(artist.title, artist.counts[i]));
      }
    }
    segments.push(seg);
  }
  return segments;
}

/** Shuffle array in-place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Build partial (SegmentData[] | undefined)[] from chosen indices. */
function buildPartial(
  fullSegments: SegmentData[][],
  chosenIndices: number[],
  totalSegments: number,
): (SegmentData[] | undefined)[] {
  const partial: (SegmentData[] | undefined)[] = new Array(totalSegments).fill(undefined);
  for (const idx of chosenIndices) {
    partial[idx] = fullSegments[idx];
  }
  return partial;
}

/** Compute peak count per artist in SeriesData[]. */
function getPeaks(data: SeriesData[]): Map<string, number> {
  const peaks = new Map<string, number>();
  for (const s of data) {
    let mx = 0;
    for (const c of s.counts) if (c > mx) mx = c;
    peaks.set(s.title, mx);
  }
  return peaks;
}

/** Count max concurrent active artists across all segments. */
function maxConcurrent(data: SeriesData[]): number {
  if (data.length === 0) return 0;
  const numSeg = data[0].counts.length;
  let mx = 0;
  for (let s = 0; s < numSeg; s++) {
    let c = 0;
    for (const d of data) if (d.counts[s] > 0) c++;
    if (c > mx) mx = c;
  }
  return mx;
}

/** Percentile of a sorted (ascending) number array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Prediction Algorithms ──────────────────────────────────────────────

type PredictionFn = (
  partialData: SeriesData[],
  k: number,
  totalSegments: number,
) => number;

/** a) Current approach: scale the target concurrent by load fraction. */
function scaledTarget(partialData: SeriesData[], k: number, totalSegments: number): number {
  const scaledConcurrent = Math.max(3, Math.round(30 * (k / totalSegments)));
  return findOptimalMinPlays(partialData, scaledConcurrent);
}

/** b) Peak extrapolation: scale each artist's observed peak by totalSegments/k. */
function peakExtrapolation(partialData: SeriesData[], k: number, totalSegments: number): number {
  if (partialData.length === 0) return 5;
  const scale = totalSegments / k;
  // Build extrapolated data: scale up each artist's peak
  const extrapolatedPeaks: number[] = [];
  for (const s of partialData) {
    let mx = 0;
    for (const c of s.counts) if (c > mx) mx = c;
    extrapolatedPeaks.push(mx * scale);
  }

  // Find threshold where ~30 artists survive
  const TARGET = 30;
  extrapolatedPeaks.sort((a, b) => b - a);

  if (extrapolatedPeaks.length <= TARGET) {
    return Math.max(5, Math.round(extrapolatedPeaks[extrapolatedPeaks.length - 1]));
  }
  // Threshold is roughly the peak of the 30th highest artist
  return Math.max(5, Math.round(extrapolatedPeaks[TARGET - 1]));
}

/** c) Direct ratio: findOptimalMinPlays on partial, then scale result. */
function directRatio(partialData: SeriesData[], k: number, totalSegments: number): number {
  const partialMinPlays = findOptimalMinPlays(partialData, 30);
  return Math.max(5, Math.round(partialMinPlays * (totalSegments / k)));
}

/** d) Percentile-based: minPlays ≈ Nth percentile of observed peaks. */
function percentileBased(partialData: SeriesData[], k: number, totalSegments: number): number {
  if (partialData.length === 0) return 5;
  const scale = totalSegments / k;
  const peaks = partialData.map(s => {
    let mx = 0;
    for (const c of s.counts) if (c > mx) mx = c;
    return mx * scale;
  }).sort((a, b) => a - b);

  // Try several percentiles, find one yielding ~30 survivors
  const TARGET = 30;
  let bestPct = 70;
  let bestDist = Infinity;
  for (const pct of [50, 55, 60, 65, 70, 75, 80, 85, 90, 95]) {
    const thresh = Math.round(percentile(peaks, pct));
    const survivors = peaks.filter(p => p >= thresh).length;
    const dist = Math.abs(survivors - TARGET);
    if (dist < bestDist) {
      bestDist = dist;
      bestPct = pct;
    }
  }
  return Math.max(5, Math.round(percentile(peaks, bestPct)));
}

/** e) Artist count ratio. */
function artistCountRatio(partialData: SeriesData[], k: number, totalSegments: number): number {
  if (partialData.length === 0) return 5;
  const partialMinPlays = findOptimalMinPlays(partialData, 30);
  const partialArtists = partialData.length;

  // Estimate how many total artists will appear with full data
  // Using capture-recapture-inspired estimation: if k segments reveal N artists,
  // total unique artists ≈ N * (totalSegments / k)^0.3 (diminishing returns)
  const estimatedTotalArtists = partialArtists * Math.pow(totalSegments / k, 0.3);
  const artistGrowthFactor = estimatedTotalArtists / partialArtists;

  // More artists → need higher minPlays to keep ~30 concurrent
  return Math.max(5, Math.round(partialMinPlays * artistGrowthFactor));
}

/** f) Weighted combination of peak extrapolation + direct ratio. */
function weightedCombo(partialData: SeriesData[], k: number, totalSegments: number): number {
  const peakPred = peakExtrapolation(partialData, k, totalSegments);
  const directPred = directRatio(partialData, k, totalSegments);
  // Weight peak extrapolation more (it tends to be more stable)
  return Math.max(5, Math.round(0.6 * peakPred + 0.4 * directPred));
}

/** g) Sqrt-scaled ratio: apply sqrt scaling instead of linear. */
function sqrtScaledRatio(partialData: SeriesData[], k: number, totalSegments: number): number {
  const partialMinPlays = findOptimalMinPlays(partialData, 30);
  return Math.max(5, Math.round(partialMinPlays * Math.sqrt(totalSegments / k)));
}

/** h) Log-scaled ratio: apply log scaling. */
function logScaledRatio(partialData: SeriesData[], k: number, totalSegments: number): number {
  const partialMinPlays = findOptimalMinPlays(partialData, 30);
  if (k <= 1) {
    // log(1) = 0 causes division by zero; fall back to sqrt scaling
    return Math.max(5, Math.round(partialMinPlays * Math.sqrt(totalSegments)));
  }
  const logScale = Math.log(totalSegments) / Math.log(k);
  return Math.max(5, Math.round(partialMinPlays * logScale));
}

/** i) Median peak scaling: use median (not algorithm) of peaks + scaling. */
function medianPeakScaling(partialData: SeriesData[], k: number, totalSegments: number): number {
  if (partialData.length === 0) return 5;
  const scale = totalSegments / k;
  const peaks = partialData.map(s => {
    let mx = 0;
    for (const c of s.counts) if (c > mx) mx = c;
    return mx;
  }).sort((a, b) => a - b);

  // Scale median peak and use as threshold
  const medPeak = percentile(peaks, 50);
  const TARGET = 30;

  // Estimate: the Nth largest scaled-peak should be the threshold
  // If we have M artists now, threshold = scaled peak of the (M - TARGET)th artist
  if (peaks.length <= TARGET) return Math.max(5, Math.round(medPeak * scale * 0.5));

  const threshIdx = peaks.length - TARGET;
  return Math.max(5, Math.round(peaks[threshIdx] * scale));
}

/** j) Conservative estimator (biased toward over-prediction). */
function conservativeEstimator(partialData: SeriesData[], k: number, totalSegments: number): number {
  const peakPred = peakExtrapolation(partialData, k, totalSegments);
  const directPred = directRatio(partialData, k, totalSegments);
  // Take the max of both (over-predicts, which is preferred for animation)
  return Math.max(5, Math.max(peakPred, directPred));
}

const ALGORITHMS: { name: string; fn: PredictionFn }[] = [
  { name: 'Scaled Target (current)', fn: scaledTarget },
  { name: 'Peak Extrapolation', fn: peakExtrapolation },
  { name: 'Direct Ratio', fn: directRatio },
  { name: 'Percentile-Based', fn: percentileBased },
  { name: 'Artist Count Ratio', fn: artistCountRatio },
  { name: 'Weighted Combo', fn: weightedCombo },
  { name: 'Sqrt-Scaled Ratio', fn: sqrtScaledRatio },
  { name: 'Log-Scaled Ratio', fn: logScaledRatio },
  { name: 'Median Peak Scaling', fn: medianPeakScaling },
  { name: 'Conservative (max)', fn: conservativeEstimator },
];

// ── Experiment Runner ──────────────────────────────────────────────────

const NUM_TRIALS = 100;
const K_VALUES = [1, 2, 3];

function runExperiment() {
  const users = loadUsers();
  if (users.length === 0) {
    console.error('No user data found!');
    process.exit(1);
  }
  console.log(`\nLoaded ${users.length} users: ${users.map(u => u.username).join(', ')}\n`);

  const allResults: TrialResult[] = [];

  for (const user of users) {
    console.log(`  Processing ${user.username} (${user.numSegments} segments, ${user.artists.length} artists)...`);
    const fullSegments = buildFullSegments(user);
    const fullPartial = buildPartial(fullSegments, [...Array(user.numSegments).keys()], user.numSegments);
    const fullData = joinSegments(fullPartial);
    const truth = findOptimalMinPlays(fullData, 30);

    const indices = [...Array(user.numSegments).keys()];

    for (let trial = 0; trial < NUM_TRIALS; trial++) {
      const shuffled = shuffle([...indices]);

      for (const k of K_VALUES) {
        const chosen = shuffled.slice(0, k);
        const partial = buildPartial(fullSegments, chosen, user.numSegments);
        const partialData = joinSegments(partial);

        for (const algo of ALGORITHMS) {
          const prediction = algo.fn(partialData, k, user.numSegments);
          const error = prediction - truth;
          const absError = Math.abs(error);
          const pctError = truth !== 0 ? (error / truth) * 100 : 0;

          allResults.push({
            algorithm: algo.name,
            k,
            prediction,
            truth,
            error,
            absError,
            pctError,
          });
        }
      }
    }
  }

  return allResults;
}

// ── Metrics Computation ────────────────────────────────────────────────

function computeMetrics(results: TrialResult[]): AlgorithmMetrics[] {
  const grouped = new Map<string, TrialResult[]>();

  for (const r of results) {
    const key = `${r.algorithm}|${r.k}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const metrics: AlgorithmMetrics[] = [];

  for (const [key, trials] of grouped) {
    const [algorithm, kStr] = key.split('|');
    const k = parseInt(kStr);

    const absErrors = trials.map(t => t.absError).sort((a, b) => a - b);
    const mae = absErrors.reduce((s, e) => s + e, 0) / absErrors.length;
    const medianAE = percentile(absErrors, 50);
    const meanPctError = trials.reduce((s, t) => s + t.pctError, 0) / trials.length;
    const meanSignedError = trials.reduce((s, t) => s + t.error, 0) / trials.length;

    const within20pct = trials.filter(t => Math.abs(t.pctError) <= 20).length / trials.length * 100;
    const within50pct = trials.filter(t => Math.abs(t.pctError) <= 50).length / trials.length * 100;

    metrics.push({
      algorithm,
      k,
      mae: Math.round(mae * 100) / 100,
      medianAE: Math.round(medianAE * 100) / 100,
      meanPctError: Math.round(meanPctError * 100) / 100,
      within20pct: Math.round(within20pct * 10) / 10,
      within50pct: Math.round(within50pct * 10) / 10,
      meanSignedError: Math.round(meanSignedError * 100) / 100,
      n: trials.length,
    });
  }

  return metrics.sort((a, b) => a.k - b.k || a.mae - b.mae);
}

// ── Output ─────────────────────────────────────────────────────────────

function pad(s: string | number, len: number, right = false): string {
  const str = String(s);
  return right ? str.padEnd(len) : str.padStart(len);
}

function printResults(metrics: AlgorithmMetrics[]) {
  for (const k of K_VALUES) {
    const kMetrics = metrics.filter(m => m.k === k);
    if (kMetrics.length === 0) continue;

    console.log(`\n${'═'.repeat(130)}`);
    console.log(`  k = ${k} segment(s) arrived`);
    console.log(`${'═'.repeat(130)}`);

    const header = [
      pad('Algorithm', 28, true),
      pad('MAE', 8),
      pad('MedAE', 8),
      pad('Mean%Err', 10),
      pad('Signed', 8),
      pad('±20%', 7),
      pad('±50%', 7),
      pad('N', 6),
    ].join(' │ ');

    console.log(header);
    console.log('─'.repeat(130));

    for (const m of kMetrics) {
      const sign = m.meanSignedError >= 0 ? '+' : '';
      const row = [
        pad(m.algorithm, 28, true),
        pad(m.mae.toFixed(1), 8),
        pad(m.medianAE.toFixed(1), 8),
        pad(m.meanPctError.toFixed(1) + '%', 10),
        pad(sign + m.meanSignedError.toFixed(1), 8),
        pad(m.within20pct.toFixed(1) + '%', 7),
        pad(m.within50pct.toFixed(1) + '%', 7),
        pad(m.n, 6),
      ].join(' │ ');
      console.log(row);
    }

    // Best algorithm
    const best = kMetrics[0]; // already sorted by MAE
    console.log(`\n  ★ Best by MAE: ${best.algorithm} (MAE=${best.mae.toFixed(1)})`);

    // Best by within-20%
    const bestW20 = [...kMetrics].sort((a, b) => b.within20pct - a.within20pct)[0];
    console.log(`  ★ Best by ±20% accuracy: ${bestW20.algorithm} (${bestW20.within20pct.toFixed(1)}%)`);

    // Best with positive bias (over-prediction preferred)
    const overPredictors = kMetrics.filter(m => m.meanSignedError > 0);
    if (overPredictors.length > 0) {
      const bestOver = overPredictors.sort((a, b) => a.mae - b.mae)[0];
      console.log(`  ★ Best over-predictor: ${bestOver.algorithm} (MAE=${bestOver.mae.toFixed(1)}, bias=+${bestOver.meanSignedError.toFixed(1)})`);
    }
  }

  // Overall summary
  console.log(`\n${'═'.repeat(130)}`);
  console.log('  OVERALL BEST ALGORITHMS');
  console.log(`${'═'.repeat(130)}`);
  for (const k of K_VALUES) {
    const kMetrics = metrics.filter(m => m.k === k);
    const best = kMetrics[0];
    const bestW20 = [...kMetrics].sort((a, b) => b.within20pct - a.within20pct)[0];
    console.log(`\n  k=${k}: Best MAE → ${best.algorithm} (${best.mae.toFixed(1)}) | Best ±20% → ${bestW20.algorithm} (${bestW20.within20pct.toFixed(1)}%)`);
  }
  console.log();

  // Note about over-prediction
  console.log('  NOTE: For streaming animation, over-predicting minPlays (positive signed error)');
  console.log('  is preferred — showing fewer artists initially is less jarring than removing them.\n');
}

// ── Main ───────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   MinPlays Prediction Experiment                           ║');
console.log('║   Testing algorithms for early prediction from partial     ║');
console.log('║   segment data during streaming animation                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const results = runExperiment();
const metrics = computeMetrics(results);
printResults(metrics);

// Save detailed results
const outputPath = path.resolve(__dirname, 'prediction-results.json');
const output = {
  generatedAt: new Date().toISOString(),
  numTrials: NUM_TRIALS,
  kValues: K_VALUES,
  algorithms: ALGORITHMS.map(a => a.name),
  metrics,
  perUserTruth: (() => {
    const users = loadUsers();
    return users.map(u => {
      const fullSegs = buildFullSegments(u);
      const fullPartial = buildPartial(fullSegs, [...Array(u.numSegments).keys()], u.numSegments);
      const fullData = joinSegments(fullPartial);
      const truth = findOptimalMinPlays(fullData, 30);
      return { username: u.username, numSegments: u.numSegments, numArtists: u.artists.length, trueMinPlays: truth };
    });
  })(),
};
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Detailed results saved to ${outputPath}`);
