/**
 * Deformed Text Quality Test Suite
 *
 * Tests the per-character deformed text placement to ensure:
 *  1. Characters stay within their wave band bounds (overflow detection)
 *  2. Font sizes are reasonable relative to band thickness
 *  3. Performance stays within bounds
 *
 * Uses the same cached last.fm data as wave-accuracy.test.ts.
 * The deform algorithm is extracted into src/core/wave/deformText.ts
 * for testability.
 *
 * Run:  npx vitest run tests/unit/deform-accuracy.test.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import Peak from '@/core/models/Peak';
import type { StackPoint } from '@/core/models/Peak';
import type { MeasureTextFn } from '@/core/wave/util';
import { findLabelIndices } from '@/core/wave/util';
import { isWType, getWLabel } from '@/core/wave/waveW';
import { isXType, getXLabel } from '@/core/wave/waveX';
import { isYType, getYLabel } from '@/core/wave/waveY';
import { isZType, getZLabel } from '@/core/wave/waveZ';
import { computeDeformedText } from '@/core/wave/deformText';
import type { BandPoint } from '@/core/wave/deformText';
import type Label from '@/core/models/Label';

// ── Constants (match WaveVisualization.tsx) ──────────────────────────
const WIDTH_PER_PEAK = 150;
const HEIGHT = 600;
const MIN_FONT_SIZE = 8;
const MIN_SEG_BETWEEN_LABELS = 3;
const FONT_FAMILY = 'DM Sans';

// ── Register DM Sans font ──────────────────────────────────────────
const fontWoff = path.resolve(__dirname, '../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff');
GlobalFonts.registerFromPath(fontWoff, 'DM Sans');

const _canvas = createCanvas(1, 1);
const _ctx = _canvas.getContext('2d');

const measureText: MeasureTextFn = (text, font, fontSize) => {
  _ctx.font = `${fontSize}px ${font}`;
  const m = _ctx.measureText(text);
  return { width: m.width, height: fontSize * 1.2, slope: (fontSize * 1.2) / m.width };
};

// ── Cached data ─────────────────────────────────────────────────────
interface CachedData {
  username: string;
  numSegments: number;
  artists: { title: string; counts: number[] }[];
}

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/wave-accuracy');

function loadCachedUsers(): CachedData[] {
  const files = fs.readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8')));
}

function getLabel(peak: Peak, text: string, stackPoints?: StackPoint[], peakIndex?: number): Label | null {
  try {
    if (isWType(peak)) return getWLabel(peak, text, FONT_FAMILY, measureText, stackPoints, peakIndex);
    if (isZType(peak)) return getZLabel(peak, text, FONT_FAMILY, measureText, stackPoints, peakIndex);
    if (isYType(peak)) return getYLabel(peak, text, FONT_FAMILY, measureText, stackPoints, peakIndex);
    if (isXType(peak)) return getXLabel(peak, text, FONT_FAMILY, measureText, stackPoints, peakIndex);
  } catch {
    return null;
  }
  return null;
}

// ── SVG path simulation for Node.js ─────────────────────────────────
// We need getPointAtLength / getTotalLength which are SVG DOM APIs.
// In Node, we simulate the monotone-x cubic Hermite spline that d3 uses.

function monotoneSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const slopes = new Array(n).fill(0);
  if (n < 2) return slopes;

  const deltas: number[] = [];
  const secants: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    deltas.push(xs[i + 1] - xs[i]);
    secants.push((ys[i + 1] - ys[i]) / deltas[i]);
  }

  slopes[0] = secants[0];
  for (let i = 1; i < n - 1; i++) {
    if (secants[i - 1] * secants[i] > 0) {
      slopes[i] = 3 * (deltas[i - 1] + deltas[i]) /
        ((2 * deltas[i] + deltas[i - 1]) / secants[i - 1] +
         (deltas[i] + 2 * deltas[i - 1]) / secants[i]);
    }
  }
  slopes[n - 1] = secants[n - 2];
  return slopes;
}

function hermitePoint(x0: number, y0: number, x1: number, y1: number,
                      m0: number, m1: number, t: number): { x: number; y: number } {
  const h = x1 - x0;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return {
    x: x0 + t * h,
    y: h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1,
  };
}

interface SplinePath {
  getPointAtLength(len: number): { x: number; y: number };
  getTotalLength(): number;
}

function buildSplinePath(bandData: BandPoint[]): SplinePath {
  const xs = bandData.map(d => d.x);
  const ys = bandData.map(d => d.centerY);
  const n = xs.length;
  const slopes = monotoneSlopes(xs, ys);

  // Pre-compute segment lengths via sampling
  const SAMPLES_PER_SEG = 20;
  const segLens: number[] = [];
  const cumLens: number[] = [0];

  for (let i = 0; i < n - 1; i++) {
    let segLen = 0;
    let prevPt = { x: xs[i], y: ys[i] };
    for (let s = 1; s <= SAMPLES_PER_SEG; s++) {
      const t = s / SAMPLES_PER_SEG;
      const pt = hermitePoint(xs[i], ys[i], xs[i + 1], ys[i + 1], slopes[i], slopes[i + 1], t);
      const dx = pt.x - prevPt.x;
      const dy = pt.y - prevPt.y;
      segLen += Math.sqrt(dx * dx + dy * dy);
      prevPt = pt;
    }
    segLens.push(segLen);
    cumLens.push(cumLens[i] + segLen);
  }

  const totalLength = cumLens[n - 1] || 0;

  function getPointAtLength(len: number): { x: number; y: number } {
    len = Math.max(0, Math.min(totalLength, len));
    // Find segment
    let seg = 0;
    for (seg = 0; seg < n - 2; seg++) {
      if (cumLens[seg + 1] >= len) break;
    }
    const segStart = cumLens[seg];
    const segEnd = cumLens[seg + 1];
    const segFrac = segEnd > segStart ? (len - segStart) / (segEnd - segStart) : 0;
    return hermitePoint(xs[seg], ys[seg], xs[seg + 1], ys[seg + 1],
                        slopes[seg], slopes[seg + 1], segFrac);
  }

  return { getPointAtLength, getTotalLength: () => totalLength };
}

// ── Test pipeline ───────────────────────────────────────────────────
interface DeformTestResult {
  artist: string;
  charCount: number;
  overflowFraction: number;
  avgFontSizeRatio: number;
}

function runDeformPipeline(data: CachedData, offsetMode: string = 'silhouette'): {
  results: DeformTestResult[];
  totalChars: number;
  totalOverflowChars: number;
  placementTimeMs: number;
} {
  const numSegs = data.numSegments;
  const width = numSegs * WIDTH_PER_PEAK;
  const keys = data.artists.map(d => d.title);

  const tableData: Record<string, number>[] = [];
  for (let i = 0; i < numSegs; i++) {
    const row: Record<string, number> = { index: i };
    data.artists.forEach(a => { row[a.title] = a.counts[i] ?? 0; });
    tableData.push(row);
  }

  const offsetFn = ({
    silhouette: d3.stackOffsetSilhouette,
    wiggle: d3.stackOffsetWiggle,
    expand: d3.stackOffsetExpand,
    zero: d3.stackOffsetNone,
  } as Record<string, any>)[offsetMode] ?? d3.stackOffsetSilhouette;

  const stack = d3.stack<Record<string, number>>()
    .keys(keys)
    .offset(offsetFn)
    .order(d3.stackOrderNone);
  const stackedData = stack(tableData);

  const xScale = d3.scaleLinear().domain([0, numSegs - 1]).range([0, width]);
  const yScale = d3.scaleLinear()
    .domain([
      d3.min(stackedData, layer => d3.min(layer, d => d[0]))!,
      d3.max(stackedData, layer => d3.max(layer, d => d[1]))!,
    ])
    .range([HEIGHT, 0]);

  const results: DeformTestResult[] = [];
  let totalChars = 0;
  let totalOverflowChars = 0;

  const start = performance.now();

  stackedData.forEach((layer, layerIndex) => {
    const seriesTitle = keys[layerIndex];
    const counts = data.artists[layerIndex].counts;
    const stackPoints: StackPoint[] = layer.map((d, i) => ({
      x: xScale(i),
      y: (HEIGHT - yScale(d[1])) - (HEIGHT - yScale(d[0])),
      y0: HEIGHT - yScale(d[0]),
    }));

    const labelIndices = findLabelIndices(counts, MIN_SEG_BETWEEN_LABELS);
    labelIndices.forEach(idx => {
      if (idx <= 0 || idx >= stackPoints.length - 1) return;
      const peak = new Peak(idx, stackPoints);
      const label = getLabel(peak, seriesTitle, stackPoints, idx);
      if (!label || label.fontSize < MIN_FONT_SIZE) return;

      // Build band data for this layer
      const bandData: BandPoint[] = layer.map((d, i) => ({
        x: xScale(i),
        topY: yScale(d[1]),
        botY: yScale(d[0]),
        centerY: (yScale(d[0]) + yScale(d[1])) / 2,
        thickness: yScale(d[0]) - yScale(d[1]),
      }));

      // Build spline path (simulates SVG getPointAtLength)
      const spline = buildSplinePath(bandData);

      function lengthAtX(targetX: number): number {
        const total = spline.getTotalLength();
        let lo = 0, hi = total;
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2;
          if (spline.getPointAtLength(mid).x < targetX) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
      }

      const result = computeDeformedText(
        label, bandData, idx, stackPoints[idx].x,
        FONT_FAMILY, measureText,
        spline.getPointAtLength.bind(spline),
        spline.getTotalLength(),
        lengthAtX,
      );

      totalChars += result.placements.length;
      totalOverflowChars += Math.round(result.overflowFraction * result.placements.length);

      results.push({
        artist: seriesTitle,
        charCount: result.placements.length,
        overflowFraction: result.overflowFraction,
        avgFontSizeRatio: result.avgFontSizeRatio,
      });
    });
  });

  const placementTimeMs = performance.now() - start;
  return { results, totalChars, totalOverflowChars, placementTimeMs };
}

// ── Tests ───────────────────────────────────────────────────────────
describe('Deformed text quality', { timeout: 120_000 }, () => {
  const users = loadCachedUsers();

  it('should have test data available', () => {
    expect(users.length).toBeGreaterThan(0);
  });

  it('should keep overflow, font sizes, and performance within baseline', () => {
    // Run silhouette offset only (representative, 4x faster than all offsets)
    const allResults: Array<{ user: string; overflowPct: number; chars: number; avgRatio: number; timeMs: number }> = [];

    for (const user of users) {
      const { totalChars, totalOverflowChars, results, placementTimeMs } = runDeformPipeline(user, 'silhouette');
      const overflowPct = totalChars > 0 ? (totalOverflowChars / totalChars) * 100 : 0;
      const ratios = results.filter(r => r.avgFontSizeRatio > 0).map(r => r.avgFontSizeRatio);
      const avgRatio = ratios.length > 0 ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0;
      allResults.push({ user: user.username, overflowPct, chars: totalChars, avgRatio, timeMs: placementTimeMs });
    }

    // Print report
    console.log('\n┌───────────────────────────────────────────────────────────────────────┐');
    console.log('│                  DEFORM TEXT QUALITY REPORT                           │');
    console.log('├──────────────────┬──────────┬───────────┬────────────┬────────────────┤');
    console.log('│ User             │ Overflow │ Chars     │ Font Ratio │ Time (ms)      │');
    console.log('├──────────────────┼──────────┼───────────┼────────────┼────────────────┤');
    for (const r of allResults) {
      const u = r.user.padEnd(16);
      const o = r.overflowPct.toFixed(1).padStart(5) + '%';
      const c = String(r.chars).padStart(6);
      const f = r.avgRatio.toFixed(3).padStart(8);
      const t = r.timeMs.toFixed(0).padStart(10);
      console.log(`│ ${u} │ ${o}  │ ${c}    │ ${f}     │ ${t}       │`);
    }
    console.log('└──────────────────┴──────────┴───────────┴────────────┴────────────────┘');

    const totalChars = allResults.reduce((s, r) => s + r.chars, 0);
    const totalOverflow = allResults.reduce((s, r) => s + r.chars * r.overflowPct / 100, 0);
    const globalOverflowPct = totalChars > 0 ? (totalOverflow / totalChars) * 100 : 0;
    const globalAvgRatio = allResults.reduce((s, r) => s + r.avgRatio, 0) / allResults.length;
    const avgTimeMs = allResults.reduce((s, r) => s + r.timeMs, 0) / allResults.length;

    console.log(`\nGlobal overflow:  ${globalOverflowPct.toFixed(2)}% (${Math.round(totalOverflow)}/${totalChars} chars)`);
    console.log(`Avg font ratio:   ${globalAvgRatio.toFixed(3)}`);
    console.log(`Avg time/user:    ${avgTimeMs.toFixed(0)}ms`);

    // Baseline (current known-good algorithm):
    //   overflow ~31%, font ratio ~0.58, time ~700ms/user
    // Thresholds set with margin to catch regressions without false positives.
    expect(globalOverflowPct).toBeLessThan(36);    // no more than ~5% regression
    expect(globalAvgRatio).toBeGreaterThan(0.4);   // font sizes stay reasonable
    expect(avgTimeMs).toBeLessThan(1500);           // generous for CI variance
  });
});
