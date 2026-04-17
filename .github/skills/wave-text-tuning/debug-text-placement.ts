/**
 * Wave Text Placement Diagnostic
 *
 * Computes label placement for specific artists and outputs centering info,
 * font sizes, band profiles, and viable regions. Used for debugging and
 * tuning the deformed text placement algorithm.
 *
 * Usage:
 *   npx tsx scripts/debug-text-placement.ts [--artist "Name"] [--width N] [--minPlays N] [--fixture username]
 *
 * Examples:
 *   npx tsx scripts/debug-text-placement.ts --fixture ewarsaba --width 1950
 *   npx tsx scripts/debug-text-placement.ts --fixture ewarsaba --artist "Nine Inch Nails" --width 768
 *   npx tsx scripts/debug-text-placement.ts --fixture Taurheim --artist "CunninLynguists"
 */
import * as d3 from 'd3';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { findLabelIndices } from '../../../src/core/wave/util';
import type { MeasureTextFn } from '../../../src/core/wave/util';
import { findOptimalLabel } from '../../../src/core/wave/bezierFit';
import { computeDeformedText } from '../../../src/core/wave/deformText';
import Peak from '../../../src/core/models/Peak';
import type { StackPoint } from '../../../src/core/models/Peak';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Font setup ─────────────────────────────────────────────────────
const fontWoff = path.resolve(__dirname, '../../../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff');
GlobalFonts.registerFromPath(fontWoff, 'DM Sans');
const _canvas = createCanvas(1, 1);
const _ctx = _canvas.getContext('2d');
const measureText: MeasureTextFn = (text, font, fontSize) => {
  _ctx.font = `${fontSize}px ${font}`;
  const m = _ctx.measureText(text);
  return { width: m.width, height: fontSize * 1.2, slope: (fontSize * 1.2) / m.width };
};

// ── Constants (match WaveVisualization.tsx) ─────────────────────────
const FONT = 'DM Sans';
const DEFAULT_WIDTH_PER_PEAK = 150;
const DEFAULT_HEIGHT = 550;
const MIN_SEG_BETWEEN = 3;
const MIN_FONT_SIZE = 8;

// ── Parse CLI args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const fixtureName = getArg('fixture') ?? 'ewarsaba';
const targetArtist = getArg('artist'); // undefined = show all
const userWidth = getArg('width') ? parseInt(getArg('width')!, 10) : 0;
const userMinPlays = getArg('minPlays') ? parseInt(getArg('minPlays')!, 10) : 0;

// ── Load data ──────────────────────────────────────────────────────
const fixtureDir = path.resolve(__dirname, '../../../tests/fixtures/wave-accuracy');
const filePath = path.join(fixtureDir, `${fixtureName}.json`);
if (!fs.existsSync(filePath)) {
  console.error(`Fixture not found: ${filePath}`);
  console.error(`Available: ${fs.readdirSync(fixtureDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).join(', ')}`);
  process.exit(1);
}
const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// ── Apply minPlays filter ──────────────────────────────────────────
let minPlays = userMinPlays;
if (!minPlays) {
  // Auto-compute like the app does (target ~30 artists)
  const sorted = rawData.artists.map((a: any) => Math.max(...a.counts)).sort((a: number, b: number) => b - a);
  minPlays = sorted.length > 30 ? sorted[29] : 1;
}
const filtered = rawData.artists.filter((a: any) => Math.max(...a.counts) >= minPlays);
console.log(`Fixture: ${fixtureName} | minPlays: ${minPlays} | Artists: ${rawData.artists.length} → ${filtered.length}`);

// ── Build stacked layout ───────────────────────────────────────────
const numSegs = rawData.numSegments;
const width = userWidth > 0 ? userWidth : numSegs * DEFAULT_WIDTH_PER_PEAK;
const height = DEFAULT_HEIGHT;
console.log(`Segments: ${numSegs} | Width: ${width} | Height: ${height} | Seg spacing: ${(width / (numSegs - 1)).toFixed(1)}px\n`);

const keys = filtered.map((d: any) => d.title);
const tableData: Record<string, number>[] = [];
for (let i = 0; i < numSegs; i++) {
  const row: Record<string, number> = {};
  filtered.forEach((a: any) => { row[a.title] = a.counts[i] || 0; });
  tableData.push(row);
}

const stack = d3.stack<Record<string, number>>().keys(keys)
  .offset(d3.stackOffsetSilhouette).order(d3.stackOrderNone);
const stackedData = stack(tableData);
const xScale = d3.scaleLinear().domain([0, numSegs - 1]).range([0, width]);
const yMin = d3.min(stackedData, layer => d3.min(layer, d => d[0]))!;
const yMax = d3.max(stackedData, layer => d3.max(layer, d => d[1]))!;
const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

// ── Process artists ────────────────────────────────────────────────
const artistsToCheck = targetArtist ? [targetArtist] : keys;

for (const artistName of artistsToCheck) {
  const layerIdx = keys.indexOf(artistName);
  if (layerIdx < 0) { console.log(`"${artistName}" NOT FOUND in filtered data`); continue; }

  const layer = stackedData[layerIdx];
  const counts = filtered[layerIdx].counts;
  const stackPoints: StackPoint[] = layer.map((d, i) => ({
    x: xScale(i),
    y: (height - yScale(d[1])) - (height - yScale(d[0])),
    y0: height - yScale(d[0]),
  }));
  const bandData = layer.map((d: readonly [number, number], i: number) => ({
    x: xScale(i),
    topY: yScale(d[1]),
    botY: yScale(d[0]),
    centerY: (yScale(d[0]) + yScale(d[1])) / 2,
    thickness: yScale(d[0]) - yScale(d[1]),
  }));

  const labelIndices = findLabelIndices(counts, MIN_SEG_BETWEEN);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${artistName}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Counts: [${counts.join(',')}]`);
  console.log(`Label peak indices: ${JSON.stringify(labelIndices.slice(0, 8))}`);

  for (const idx of labelIndices.slice(0, 5)) {
    if (idx <= 0 || idx >= stackPoints.length - 1) continue;
    const peak = new Peak(idx, stackPoints);

    // Get both straight and deform labels for comparison
    const straightLabel = findOptimalLabel(peak, artistName, FONT, measureText, stackPoints, idx, false);
    const deformLabel = findOptimalLabel(peak, artistName, FONT, measureText, stackPoints, idx, true);

    const label = deformLabel;
    if (!label || label.fontSize < MIN_FONT_SIZE) {
      console.log(`\n  Peak idx=${idx} count=${counts[idx]}: NO LABEL (fontSize=${label?.fontSize ?? 0})`);
      continue;
    }

    const result = computeDeformedText(
      label, bandData, idx, stackPoints[idx].x,
      FONT, measureText, undefined, true,
    );

    console.log(`\n  Peak idx=${idx} count=${counts[idx]}`);
    console.log(`  ├─ Band thickness: ${stackPoints[idx].y.toFixed(1)}px`);
    console.log(`  ├─ Straight fontSize: ${straightLabel?.fontSize ?? 'null'}`);
    console.log(`  ├─ Deform fontSize:   ${label.fontSize}`);
    console.log(`  ├─ Label position:    (${label.xPosition.toFixed(1)}, ${label.yPosition.toFixed(1)})`);
    console.log(`  ├─ Debug center:      (${result.debugCenterX?.toFixed(1) ?? 'N/A'}, ${result.debugCenterY?.toFixed(1) ?? 'N/A'})`);
    console.log(`  ├─ Peak x:            ${stackPoints[idx].x.toFixed(1)}`);
    console.log(`  ├─ Overflow:          ${(result.overflowFraction * 100).toFixed(1)}%`);
    console.log(`  ├─ Avg fontSizeRatio: ${result.avgFontSizeRatio.toFixed(3)}`);

    // Band profile
    console.log(`  └─ Band profile (±5 segments):`);
    for (let i = Math.max(0, idx - 5); i <= Math.min(bandData.length - 1, idx + 5); i++) {
      const bar = '█'.repeat(Math.max(0, Math.round(bandData[i].thickness / 5)));
      const marker = i === idx ? ' ◄── PEAK' : '';
      console.log(`       [${String(i).padStart(2)}] x=${bandData[i].x.toFixed(0).padStart(5)} thick=${bandData[i].thickness.toFixed(1).padStart(6)} cY=${bandData[i].centerY.toFixed(0).padStart(4)} ${bar}${marker}`);
    }

    // Character placements summary
    const visible = result.placements.filter(p => p.fontSize >= 4 && p.opacity > 0);
    if (visible.length > 0) {
      const minFS = Math.min(...visible.map(p => p.fontSize));
      const maxFS = Math.max(...visible.map(p => p.fontSize));
      const xRange = `${visible[0].x.toFixed(0)}-${visible[visible.length - 1].x.toFixed(0)}`;
      console.log(`     Characters: ${visible.length}/${result.placements.length} visible, fontSize ${minFS.toFixed(0)}-${maxFS.toFixed(0)}, x-range ${xRange}`);
    }
  }
}
