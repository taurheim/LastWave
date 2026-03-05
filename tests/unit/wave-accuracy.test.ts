/**
 * Wave Algorithm Accuracy Test Suite
 *
 * Runs the full wave text-placement pipeline on cached last.fm data
 * and scores the algorithm's accuracy based on Bezier overflow detection.
 *
 * Scoring:
 *  - Each placed label is checked for text overflow against the Bezier curves
 *  - Labels with ≤0% overflow contribute 0 penalty
 *  - Labels with 0–10% overflow: penalty = overflowPct (minor)
 *  - Labels with >10% overflow: penalty = overflowPct × 10 (critical, 10× weight)
 *  - Score = 100 × (1 − totalPenalty / maxPenalty)
 *  - maxPenalty assumes every label at the "critical" threshold (50% × 10 = 500)
 *    Normalization is fixed at 250 per label so score changes reflect algorithm changes
 *
 * Run:  npm test -- --reporter=verbose wave-accuracy
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
import { buildBandLUT } from '@/core/wave/overflowDetection';
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

// Algorithm measurement (height = fontSize * 1.2, matches createCanvasMeasurer)
const measureText: MeasureTextFn = (text, font, fontSize) => {
  _ctx.font = `${fontSize}px ${font}`;
  const m = _ctx.measureText(text);
  return { width: m.width, height: fontSize * 1.2, slope: (fontSize * 1.2) / m.width };
};

// Actual glyph bounds for overflow detection
function getActualBounds(text: string, fontSize: number) {
  _ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  const m = _ctx.measureText(text);
  return { width: m.width, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
}

// ── Algorithm classification ────────────────────────────────────────
function getLabel(peak: Peak, text: string): Label | null {
  if (isWType(peak)) return getWLabel(peak, text, FONT_FAMILY, measureText);
  if (isZType(peak)) return getZLabel(peak, text, FONT_FAMILY, measureText);
  if (isYType(peak)) return getYLabel(peak, text, FONT_FAMILY, measureText);
  if (isXType(peak)) return getXLabel(peak, text, FONT_FAMILY, measureText);
  return null;
}

// ── Cached data loader ──────────────────────────────────────────────
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

// ── Overflow computation ────────────────────────────────────────────
interface LabelResult {
  artist: string;
  overflowPct: number;
}

function runPipeline(data: CachedData): { labels: LabelResult[]; totalLabels: number } {
  const numSegs = data.numSegments;
  const width = numSegs * WIDTH_PER_PEAK;
  const keys = data.artists.map(d => d.title);

  const tableData: Record<string, number>[] = [];
  for (let i = 0; i < numSegs; i++) {
    const row: Record<string, number> = {};
    data.artists.forEach(a => { row[a.title] = a.counts[i] || 0; });
    tableData.push(row);
  }

  const stack = d3.stack<Record<string, number>>()
    .keys(keys)
    .offset(d3.stackOffsetSilhouette)
    .order(d3.stackOrderNone);
  const stackedData = stack(tableData);

  const xScale = d3.scaleLinear().domain([0, numSegs - 1]).range([0, width]);
  const yMin = d3.min(stackedData, layer => d3.min(layer, d => d[0])) ?? 0;
  const yMax = d3.max(stackedData, layer => d3.max(layer, d => d[1])) ?? 0;
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([HEIGHT, 0]);

  const area = d3.area<[number, number]>()
    .x((_, i) => xScale(i))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  const results: LabelResult[] = [];
  let totalLabels = 0;

  stackedData.forEach((layer, layerIdx) => {
    const title = keys[layerIdx];
    const counts = data.artists[layerIdx].counts;

    const stackPoints: StackPoint[] = layer.map((d, i) => ({
      x: xScale(i),
      y: (HEIGHT - yScale(d[1])) - (HEIGHT - yScale(d[0])),
      y0: HEIGHT - yScale(d[0]),
    }));

    const pathD = area(layer as any);
    if (!pathD) return;

    const bandLUT = buildBandLUT(pathD, width);
    if (!bandLUT) return;

    const labelIndices = findLabelIndices(counts, MIN_SEG_BETWEEN_LABELS);

    labelIndices.forEach(idx => {
      if (idx <= 0 || idx >= stackPoints.length - 1) return;

      const peak = new Peak(idx, stackPoints);
      const label = getLabel(peak, title);
      if (!label || label.fontSize < MIN_FONT_SIZE) return;

      totalLabels++;

      const bounds = getActualBounds(label.text, label.fontSize);
      const baselineSvgY = HEIGHT - label.yPosition;
      const textLeft = Math.max(0, Math.floor(label.xPosition));
      const textRight = Math.min(width - 1, Math.ceil(label.xPosition + bounds.width));
      const textTop = baselineSvgY - bounds.ascent;
      const textBot = baselineSvgY + bounds.descent;
      const textH = bounds.ascent + bounds.descent;

      if (textH <= 0) return;

      let overflowArea = 0;
      let totalCols = 0;

      for (let px = textLeft; px <= textRight; px++) {
        const b = bandLUT[px];
        if (!b) continue;
        totalCols++;
        const overTop = Math.max(0, b.top - textTop);
        const overBot = Math.max(0, textBot - b.bot);
        overflowArea += Math.min(overTop + overBot, textH);
      }

      const totalArea = totalCols * textH;
      const pct = totalArea > 0 ? (overflowArea / totalArea) * 100 : 0;

      if (pct > 0.5) {
        results.push({ artist: title, overflowPct: Math.round(pct * 10) / 10 });
      }
    });
  });

  return { labels: results, totalLabels };
}

// ── Scoring ─────────────────────────────────────────────────────────
function computeScore(allResults: LabelResult[], totalLabels: number): number {
  if (totalLabels === 0) return 100;

  let totalPenalty = 0;
  for (const r of allResults) {
    if (r.overflowPct <= 10) {
      // Minor: linear penalty, low weight
      totalPenalty += r.overflowPct;
    } else {
      // Critical: 10× weight
      totalPenalty += r.overflowPct * 10;
    }
  }

  // Normalize: max penalty assumes every label at 50% critical (250 penalty points each)
  const maxPenalty = totalLabels * 250;
  const score = 100 * (1 - totalPenalty / maxPenalty);
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

// ══════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════

describe('Wave Algorithm Accuracy', () => {
  const users = loadCachedUsers();
  const allResults: LabelResult[] = [];
  let grandTotalLabels = 0;

  const userSummaries: {
    username: string;
    totalLabels: number;
    overflows: number;
    critical: number;
    score: number;
  }[] = [];

  // Run per-user tests
  for (const user of users) {
    it(`processes ${user.username} (${user.artists.length} artists)`, () => {
      const { labels, totalLabels } = runPipeline(user);
      const critical = labels.filter(l => l.overflowPct > 10);

      allResults.push(...labels);
      grandTotalLabels += totalLabels;

      userSummaries.push({
        username: user.username,
        totalLabels,
        overflows: labels.length,
        critical: critical.length,
        score: computeScore(labels, totalLabels),
      });

      // Log per-user results
      if (critical.length > 0) {
        const sorted = critical.sort((a, b) => b.overflowPct - a.overflowPct);
        console.log(`    ${user.username}: ${totalLabels} labels, ${labels.length} overflows (${critical.length} critical >10%)`);
        for (const r of sorted.slice(0, 5)) {
          console.log(`      ⚠ ${r.artist}: ${r.overflowPct}%`);
        }
        if (sorted.length > 5) console.log(`      ... and ${sorted.length - 5} more`);
      }

      // Each user should eventually have 0 critical overflows — soft check for now
      expect(totalLabels).toBeGreaterThan(0);
    });
  }

  // Overall score
  it('computes overall accuracy score', () => {
    const score = computeScore(allResults, grandTotalLabels);
    const critical = allResults.filter(l => l.overflowPct > 10);
    const minor = allResults.filter(l => l.overflowPct <= 10);

    console.log('\n  ╔══════════════════════════════════════════════════╗');
    console.log('  ║         WAVE ALGORITHM ACCURACY REPORT          ║');
    console.log('  ╠══════════════════════════════════════════════════╣');
    console.log(`  ║  Users tested:         ${String(users.length).padStart(5)}                   ║`);
    console.log(`  ║  Total labels placed:  ${String(grandTotalLabels).padStart(5)}                   ║`);
    console.log(`  ║  Minor overflows:      ${String(minor.length).padStart(5)}  (≤10%)            ║`);
    console.log(`  ║  Critical overflows:   ${String(critical.length).padStart(5)}  (>10%)            ║`);
    console.log('  ╠══════════════════════════════════════════════════╣');

    // Per-user breakdown
    for (const u of userSummaries.sort((a, b) => a.score - b.score)) {
      const name = u.username.padEnd(18);
      const labels = String(u.totalLabels).padStart(4);
      const crit = u.critical > 0 ? `${u.critical} crit`.padStart(7) : '      —';
      const sc = u.score.toFixed(1).padStart(5);
      console.log(`  ║  ${name} ${labels} labels ${crit}  ${sc}/100 ║`);
    }

    console.log('  ╠══════════════════════════════════════════════════╣');
    console.log(`  ║  OVERALL SCORE:              ${score.toFixed(1).padStart(5)}/100          ║`);
    console.log('  ╚══════════════════════════════════════════════════╝\n');

    // The score is a benchmark — log it clearly so we can track improvements
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
