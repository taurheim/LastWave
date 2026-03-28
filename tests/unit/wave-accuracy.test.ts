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
import { computeDeformedText } from '@/core/wave/deformTextOptB';
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

// ── Offset modes (match WaveVisualization.tsx) ──────────────────────
const OFFSET_MAP: Record<string, (series: d3.Series<any, any>, order: number[]) => void> = {
  silhouette: d3.stackOffsetSilhouette,
  wiggle: d3.stackOffsetWiggle,
  expand: d3.stackOffsetExpand,
  zero: d3.stackOffsetNone,
};

type OffsetMode = keyof typeof OFFSET_MAP;
const ALL_OFFSETS: OffsetMode[] = ['silhouette', 'wiggle', 'expand', 'zero'];

// ── Overflow computation ────────────────────────────────────────────
interface LabelResult {
  artist: string;
  overflowPct: number;
}

interface FontSizeData {
  fontSize: number;
  bandHeight: number;
}

interface DeformLabelResult {
  artist: string;
  overflowPct: number;
  visibleChars: number;
  totalChars: number;
}

function runPipeline(data: CachedData, offsetMode: OffsetMode = 'silhouette'): { labels: LabelResult[]; deformLabels: DeformLabelResult[]; totalLabels: number; fontSizeData: FontSizeData[]; placementTimeMs: number; totalSeries: number; seriesWithDeformLabel: number; seriesWithStraightLabel: number } {
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
    .offset(OFFSET_MAP[offsetMode])
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
  const deformResults: DeformLabelResult[] = [];
  const fontSizeData: FontSizeData[] = [];
  let totalLabels = 0;
  let placementTimeMs = 0;
  const totalSeries = stackedData.length;
  let seriesWithDeformLabel = 0;
  let seriesWithStraightLabel = 0;

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

    // Band data for deformed text (matches WaveVisualization.tsx)
    const bandData = (layer as any).map((d: readonly [number, number], i: number) => ({
      x: xScale(i),
      topY: yScale(d[1]),
      botY: yScale(d[0]),
      centerY: (yScale(d[0]) + yScale(d[1])) / 2,
      thickness: yScale(d[0]) - yScale(d[1]),
    }));

    const labelIndices = findLabelIndices(counts, MIN_SEG_BETWEEN_LABELS);

    let hasDeformLabel = false;
    let hasStraightLabel = false;

    labelIndices.forEach(idx => {
      if (idx <= 0 || idx >= stackPoints.length - 1) return;

      const peak = new Peak(idx, stackPoints);
      const t0 = performance.now();
      const label = getLabel(peak, title, stackPoints, idx);
      placementTimeMs += performance.now() - t0;
      if (!label || !isFinite(label.fontSize) || label.fontSize < MIN_FONT_SIZE) return;

      totalLabels++;
      hasDeformLabel = true;

      // Check straight-text (non-deform) visibility
      const dims = measureText(label.text, FONT_FAMILY, label.fontSize);
      const textW = dims.width;
      let straightVisible = true;

      if (label.xPosition < 0 || label.xPosition + textW > width) {
        straightVisible = false;
      }

      // Edge check (matches WaveVisualization.tsx non-deform path)
      if (straightVisible) {
        const textH = label.fontSize * 1.2;
        const numPts = stackPoints.length;
        const edgeMargin = Math.max(2, Math.ceil(numPts * 0.1));
        const li = Math.max(0, Math.ceil(label.xPosition * (numPts - 1) / width));
        const ri = Math.min(numPts - 1, Math.ceil((label.xPosition + textW) * (numPts - 1) / width));
        for (let i = li; i <= ri; i++) {
          const atEdge = i < edgeMargin || i >= numPts - edgeMargin;
          if (atEdge && stackPoints[i].y < textH) {
            straightVisible = false;
            break;
          }
        }
      }

      if (straightVisible) hasStraightLabel = true;

      // ── Straight-text overflow detection ──
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
      } else {
        const bandHeight = peak.top.y - peak.bottom.y;
        if (bandHeight > 0) {
          fontSizeData.push({ fontSize: label.fontSize, bandHeight });
        }
      }

      // ── Deformed-text overflow detection ──
      const deformResult = computeDeformedText(
        label, bandData, idx, stackPoints[idx].x,
        FONT_FAMILY, measureText,
      );

      let visibleChars = 0;
      let deformOverflowArea = 0;
      let deformTotalArea = 0;

      for (const p of deformResult.placements) {
        const isVisible = p.fontSize >= 4 && p.opacity > 0;
        if (isVisible) visibleChars++;

        // Rotation-aware bounding box overflow against Bezier-accurate bandLUT
        const rad = Math.abs(p.angle * Math.PI / 180);
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const halfW = p.width / 2;
        const halfH = (p.fontSize * p.scaleY * 1.2) / 2;
        const rotatedHalfH = halfW * sinA + halfH * cosA;
        const charH = rotatedHalfH * 2;

        const px = Math.round(p.x);
        const b = px >= 0 && px < bandLUT.length ? bandLUT[px] : null;
        if (b && charH > 0) {
          const charTop = p.y - rotatedHalfH;
          const charBot = p.y + rotatedHalfH;
          const overTop = Math.max(0, b.top - charTop);
          const overBot = Math.max(0, charBot - b.bot);
          deformOverflowArea += Math.min(overTop + overBot, charH);
          deformTotalArea += charH;
        }
      }

      const deformPct = deformTotalArea > 0 ? (deformOverflowArea / deformTotalArea) * 100 : 0;
      if (deformPct > 0.5 || visibleChars < label.text.length) {
        deformResults.push({
          artist: title,
          overflowPct: Math.round(deformPct * 10) / 10,
          visibleChars,
          totalChars: label.text.length,
        });
      }
    });

    if (hasDeformLabel) seriesWithDeformLabel++;
    if (hasStraightLabel) seriesWithStraightLabel++;
  });

  return { labels: results, deformLabels: deformResults, totalLabels, fontSizeData, placementTimeMs, totalSeries, seriesWithDeformLabel, seriesWithStraightLabel };
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

function computeFontSizeRatio(fontSizeData: FontSizeData[]): number {
  if (fontSizeData.length === 0) return 0;
  const totalRatio = fontSizeData.reduce((sum, d) => sum + Math.min(d.fontSize / d.bandHeight, 1.0), 0);
  return Math.round((totalRatio / fontSizeData.length) * 1000) / 1000;
}

// ══════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════

interface OffsetSummary {
  offset: OffsetMode;
  totalLabels: number;
  overflows: number;
  critical: number;
  overflowScore: number;
  deformOverflows: number;
  deformCritical: number;
  deformOverflowScore: number;
  deformHiddenChars: number;
  avgFontFill: number;
  placementTimeMs: number;
  deformCoverage: number;
  straightCoverage: number;
}

describe('Wave Algorithm Accuracy', () => {
  const users = loadCachedUsers();
  const offsetSummaries: OffsetSummary[] = [];

  for (const offset of ALL_OFFSETS) {
    describe(`offset: ${offset}`, () => {
      const allResults: LabelResult[] = [];
      const allDeformResults: DeformLabelResult[] = [];
      const allFontSizeData: FontSizeData[] = [];
      let grandTotalLabels = 0;
      let totalPlacementTimeMs = 0;
      let grandTotalSeries = 0;
      let grandDeformLabeled = 0;
      let grandStraightLabeled = 0;

      for (const user of users) {
        it(`processes ${user.username} (${user.artists.length} artists)`, () => {
          const { labels, deformLabels, totalLabels, fontSizeData, placementTimeMs, totalSeries, seriesWithDeformLabel, seriesWithStraightLabel } = runPipeline(user, offset);
          const critical = labels.filter(l => l.overflowPct > 10);
          const deformCritical = deformLabels.filter(l => l.overflowPct > 10);

          allResults.push(...labels);
          allDeformResults.push(...deformLabels);
          allFontSizeData.push(...fontSizeData);
          grandTotalLabels += totalLabels;
          totalPlacementTimeMs += placementTimeMs;
          grandTotalSeries += totalSeries;
          grandDeformLabeled += seriesWithDeformLabel;
          grandStraightLabeled += seriesWithStraightLabel;

          if (critical.length > 0) {
            const sorted = critical.sort((a, b) => b.overflowPct - a.overflowPct);
            console.log(`    [${offset}] ${user.username}: ${totalLabels} labels, ${labels.length} overflows (${critical.length} critical >10%)`);
            for (const r of sorted.slice(0, 5)) {
              console.log(`      ⚠ ${r.artist}: ${r.overflowPct}%`);
            }
            if (sorted.length > 5) console.log(`      ... and ${sorted.length - 5} more`);
          }

          if (deformCritical.length > 0) {
            const sorted = deformCritical.sort((a, b) => b.overflowPct - a.overflowPct);
            console.log(`    [${offset}] ${user.username} DEFORM: ${deformLabels.length} issues (${deformCritical.length} critical >10%)`);
            for (const r of sorted.slice(0, 5)) {
              console.log(`      ⚠ ${r.artist}: ${r.overflowPct}% overflow, ${r.visibleChars}/${r.totalChars} chars visible`);
            }
            if (sorted.length > 5) console.log(`      ... and ${sorted.length - 5} more`);
          }

          expect(totalLabels).toBeGreaterThan(0);
        });
      }

      it(`computes ${offset} accuracy score`, () => {
        const score = computeScore(allResults, grandTotalLabels);
        const deformScore = computeScore(
          allDeformResults.map(d => ({ artist: d.artist, overflowPct: d.overflowPct })),
          grandTotalLabels,
        );
        const avgFontFill = computeFontSizeRatio(allFontSizeData);
        const deformCov = grandTotalSeries > 0 ? Math.round((grandDeformLabeled / grandTotalSeries) * 1000) / 10 : 0;
        const straightCov = grandTotalSeries > 0 ? Math.round((grandStraightLabeled / grandTotalSeries) * 1000) / 10 : 0;
        const deformHidden = allDeformResults.reduce((sum, d) => sum + (d.totalChars - d.visibleChars), 0);

        offsetSummaries.push({
          offset,
          totalLabels: grandTotalLabels,
          overflows: allResults.length,
          critical: allResults.filter(l => l.overflowPct > 10).length,
          overflowScore: score,
          deformOverflows: allDeformResults.filter(d => d.overflowPct > 0.5).length,
          deformCritical: allDeformResults.filter(d => d.overflowPct > 10).length,
          deformOverflowScore: deformScore,
          deformHiddenChars: deformHidden,
          avgFontFill,
          placementTimeMs: totalPlacementTimeMs,
          deformCoverage: deformCov,
          straightCoverage: straightCov,
        });

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        expect(deformScore).toBeGreaterThanOrEqual(0);
        expect(deformScore).toBeLessThanOrEqual(100);
      });
    });
  }

  // Combined report — one row per (text mode × offset) combination
  it('prints combined accuracy report', () => {
    type Row = { mode: string; offset: string; labels: number; overflow: number; deformOvF: number; coverage: number; hiddenCh: number; fontFill: number; time: number };
    const rows: Row[] = [];

    for (const o of offsetSummaries) {
      rows.push({ mode: 'deform', offset: o.offset, labels: o.totalLabels, overflow: o.overflowScore, deformOvF: o.deformOverflowScore, coverage: o.deformCoverage, hiddenCh: o.deformHiddenChars, fontFill: o.avgFontFill, time: o.placementTimeMs });
      rows.push({ mode: 'straight', offset: o.offset, labels: o.totalLabels, overflow: o.overflowScore, deformOvF: 0, coverage: o.straightCoverage, hiddenCh: 0, fontFill: o.avgFontFill, time: o.placementTimeMs });
    }

    console.log('\n  ╔══════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('  ║                        WAVE ALGORITHM ACCURACY REPORT                               ║');
    console.log('  ╠══════════════════════════════════════════════════════════════════════════════════════╣');
    console.log('  ║  Mode      Offset       Labels  Straight  Deform   Coverage  Hidden  FontFill Time  ║');
    console.log('  ║                                  OvF Scr   OvF Scr                    Chars          ║');
    console.log('  ╠══════════════════════════════════════════════════════════════════════════════════════╣');

    for (const r of rows) {
      const mode = r.mode.padEnd(9);
      const offset = r.offset.padEnd(12);
      const labels = String(r.labels).padStart(5);
      const ov = r.overflow.toFixed(1).padStart(6);
      const dov = r.mode === 'deform' ? r.deformOvF.toFixed(1).padStart(6) : '     -';
      const cov = (r.coverage.toFixed(1) + '%').padStart(7);
      const hid = r.mode === 'deform' ? String(r.hiddenCh).padStart(6) : '     -';
      const ff = r.fontFill.toFixed(2).padStart(6);
      const tm = (r.time.toFixed(0) + 'ms').padStart(6);
      console.log(`  ║  ${mode} ${offset} ${labels}  ${ov}  ${dov}   ${cov}  ${hid}  ${ff} ${tm}  ║`);
    }

    const avgOverflow = offsetSummaries.reduce((s, o) => s + o.overflowScore, 0) / offsetSummaries.length;
    const avgDeformOverflow = offsetSummaries.reduce((s, o) => s + o.deformOverflowScore, 0) / offsetSummaries.length;
    const avgDeformCov = offsetSummaries.reduce((s, o) => s + o.deformCoverage, 0) / offsetSummaries.length;
    const avgStraightCov = offsetSummaries.reduce((s, o) => s + o.straightCoverage, 0) / offsetSummaries.length;
    const avgFontFill = offsetSummaries.reduce((s, o) => s + o.avgFontFill, 0) / offsetSummaries.length;
    const avgTime = offsetSummaries.reduce((s, o) => s + o.placementTimeMs, 0) / offsetSummaries.length;
    const totalHidden = offsetSummaries.reduce((s, o) => s + o.deformHiddenChars, 0);

    console.log('  ╠══════════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`  ║  AVG STRAIGHT OVF: ${avgOverflow.toFixed(1).padStart(6)}/100                                                ║`);
    console.log(`  ║  AVG DEFORM OVF:   ${avgDeformOverflow.toFixed(1).padStart(6)}/100                                                ║`);
    console.log(`  ║  AVG DEFORM COV:   ${avgDeformCov.toFixed(1).padStart(5)}%                                                  ║`);
    console.log(`  ║  AVG STRAIGHT COV: ${avgStraightCov.toFixed(1).padStart(5)}%                                                  ║`);
    console.log(`  ║  TOTAL HIDDEN CH:  ${String(totalHidden).padStart(5)}  (deform chars with opacity=0 or fontSize<4)        ║`);
    console.log(`  ║  AVG FONT FILL:    ${avgFontFill.toFixed(2).padStart(6)}  (fontSize / bandHeight)                           ║`);
    console.log(`  ║  AVG TIME:         ${avgTime.toFixed(0).padStart(5)}ms                                                   ║`);
    console.log('  ╚══════════════════════════════════════════════════════════════════════════════════════╝\n');

    for (const o of offsetSummaries) {
      expect(o.overflowScore).toBeGreaterThanOrEqual(0);
      expect(o.deformOverflowScore).toBeGreaterThanOrEqual(0);
    }
  });
});
