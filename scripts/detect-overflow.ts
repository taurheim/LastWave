/**
 * Detect text labels that overflow their Bezier-curved stream band boundaries.
 *
 * Usage: npx tsx scripts/detect-overflow.ts <username> [preset]
 *   preset: "2w" | "3m" (default) | "1y"
 *
 * Uses the REAL wave algorithms from src/core/wave/ to position text,
 * then checks the text bounding box against the actual D3 Bezier curve.
 * Uses @napi-rs/canvas with DM Sans font for accurate text metrics.
 */

import * as d3 from 'd3';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import * as path from 'path';
import Peak from '../src/core/models/Peak';
import type { StackPoint } from '../src/core/models/Peak';
import { findLabelIndices } from '../src/core/wave/util';
import type { MeasureTextFn } from '../src/core/wave/util';
import { isWType, getWLabel } from '../src/core/wave/waveW';
import { isXType, getXLabel } from '../src/core/wave/waveX';
import { isYType, getYLabel } from '../src/core/wave/waveY';
import { isZType, getZLabel } from '../src/core/wave/waveZ';
import type Label from '../src/core/models/Label';

// ── Constants (match WaveVisualization.tsx) ───────────────────────────
const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const CADENCE_MS = 100;
const DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH_PER_PEAK = 150;
const MIN_FONT_SIZE = 8;
const MIN_SEG_BETWEEN_LABELS = 3;
const FONT_FAMILY = 'DM Sans';

// ── last.fm API ──────────────────────────────────────────────────────
interface SegmentEntry { title: string; count: number; }

async function fetchSegment(user: string, from: number, to: number): Promise<SegmentEntry[]> {
  const url = `${API_BASE}?method=user.getweeklyartistchart&api_key=${API_KEY}&format=json&user=${encodeURIComponent(user)}&from=${from}&to=${to}`;
  const res = await fetch(url);
  const json = await res.json();
  const root = json.weeklyartistchart;
  if (!root || !root.artist) return [];
  const artists = Array.isArray(root.artist) ? root.artist : [root.artist];
  return artists.map((a: any) => ({ title: a.name, count: parseInt(a.playcount, 10) }));
}

function splitTimeSpan(groupBy: string, startUnix: number, endUnix: number): [number, number][] {
  const intervals: Record<string, number> = { week: 604800, day: 86400, month: 2628000 };
  const dt = intervals[groupBy] || 604800;
  const segs: [number, number][] = [];
  for (let t = startUnix; t < endUnix; t += dt) segs.push([t, t + dt]);
  return segs;
}

interface SeriesData { title: string; counts: number[]; }

function joinSegments(segmentData: SegmentEntry[][]): SeriesData[] {
  const map: Record<string, SeriesData> = {};
  segmentData.forEach((seg, idx) => {
    seg.forEach(({ title, count }) => {
      if (!map[title]) map[title] = { title, counts: new Array(segmentData.length).fill(0) };
      map[title].counts[idx] = count;
    });
  });
  return Object.values(map);
}

function cleanByMinPlays(data: SeriesData[], min: number): SeriesData[] {
  return data.filter(d => Math.max(...d.counts) >= min);
}

// ── Register DM Sans font for accurate metrics ──────────────────────
const fontPath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff');
GlobalFonts.registerFromPath(fontPath, 'DM Sans');

// Shared canvas context for measurement
const _canvas = createCanvas(1, 1);
const _ctx = _canvas.getContext('2d');

// ── Text measurement (matches app's createCanvasMeasurer: height = fontSize*1.2) ──
// The algorithm uses this to decide text size and position.
const measureText: MeasureTextFn = (text: string, font: string, fontSize: number) => {
  _ctx.font = `${fontSize}px ${font}`;
  const m = _ctx.measureText(text);
  const width = m.width;
  const height = fontSize * 1.2; // matches createCanvasMeasurer in util.ts
  return { width, height, slope: height / width };
};

// ── Actual glyph bounds (for overflow detection, uses real ascent/descent) ──
function getActualBounds(text: string, font: string, fontSize: number) {
  _ctx.font = `${fontSize}px ${font}`;
  const m = _ctx.measureText(text);
  return {
    width: m.width,
    ascent: m.actualBoundingBoxAscent,   // baseline → top (positive up)
    descent: m.actualBoundingBoxDescent, // baseline → bottom (positive down)
  };
}

// ── SVG path parsing & Bezier sampling ───────────────────────────────
interface PathCmd { cmd: string; args: number[]; }

function parsePath(d: string): PathCmd[] {
  const cmds: PathCmd[] = [];
  const re = /([MLCZmlcz])([^MLCZmlcz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const nums = m[2].trim().split(/[\s,]+/).filter(s => s.length > 0).map(Number);
    cmds.push({ cmd: m[1], args: nums });
  }
  return cmds;
}

function buildCurveLUT(pathD: string, width: number): Float64Array {
  const cmds = parsePath(pathD);
  const samples = new Float64Array(Math.ceil(width) + 2).fill(NaN);

  let cx = 0, cy = 0;
  for (const { cmd, args } of cmds) {
    if (cmd === 'M') {
      cx = args[0]; cy = args[1];
      const ix = Math.round(cx);
      if (ix >= 0 && ix < samples.length) samples[ix] = cy;
    } else if (cmd === 'L') {
      const x1 = args[0], y1 = args[1];
      const dx = x1 - cx, dy = y1 - cy;
      const steps = Math.max(Math.abs(Math.round(dx)), 1);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const ix = Math.round(cx + dx * t);
        if (ix >= 0 && ix < samples.length) samples[ix] = cy + dy * t;
      }
      cx = x1; cy = y1;
    } else if (cmd === 'C') {
      const p0x = cx, p0y = cy;
      const p1x = args[0], p1y = args[1];
      const p2x = args[2], p2y = args[3];
      const p3x = args[4], p3y = args[5];
      const numSamples = Math.max(Math.abs(Math.round(p3x - p0x)) * 3, 30);
      for (let s = 0; s <= numSamples; s++) {
        const t = s / numSamples;
        const u = 1 - t;
        const sx = u*u*u*p0x + 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t*p3x;
        const sy = u*u*u*p0y + 3*u*u*t*p1y + 3*u*t*t*p2y + t*t*t*p3y;
        const ix = Math.round(sx);
        if (ix >= 0 && ix < samples.length) samples[ix] = sy;
      }
      cx = args[4]; cy = args[5];
    }
  }

  // Fill gaps with linear interpolation
  let lastValid = -1;
  for (let i = 0; i < samples.length; i++) {
    if (!isNaN(samples[i])) {
      if (lastValid >= 0 && i - lastValid > 1) {
        const y0 = samples[lastValid], y1 = samples[i];
        for (let j = lastValid + 1; j < i; j++) {
          samples[j] = y0 + (y1 - y0) * (j - lastValid) / (i - lastValid);
        }
      }
      lastValid = i;
    }
  }
  return samples;
}

/**
 * D3 area path = top curve (left→right) + L + bottom curve (right→left) + Z
 * Returns lookup tables for top and bottom SVG-y at each pixel x.
 */
function buildBandLUT(areaPathD: string, width: number) {
  const cmds = parsePath(areaPathD);
  let splitIdx = -1;
  for (let i = 1; i < cmds.length; i++) {
    if (cmds[i].cmd === 'L') { splitIdx = i; break; }
  }
  if (splitIdx < 0) return null;

  const topCmds = cmds.slice(0, splitIdx);
  const botCmds = [
    { cmd: 'M', args: cmds[splitIdx].args },
    ...cmds.slice(splitIdx + 1).filter(c => c.cmd !== 'Z'),
  ];

  const topPathD = topCmds.map(c => c.cmd + c.args.join(',')).join('');
  const botPathD = botCmds.map(c => c.cmd + c.args.join(',')).join('');

  return { topY: buildCurveLUT(topPathD, width), botY: buildCurveLUT(botPathD, width) };
}

// ── Algo classification ──────────────────────────────────────────────
function getAlgoType(peak: Peak): string {
  if (isWType(peak)) return 'W';
  if (isZType(peak)) return 'Z';
  if (isYType(peak)) return 'Y';
  if (isXType(peak)) return 'X';
  return '?';
}

function getLabel(peak: Peak, text: string): Label | null {
  if (isWType(peak)) return getWLabel(peak, text, FONT_FAMILY, measureText);
  if (isZType(peak)) return getZLabel(peak, text, FONT_FAMILY, measureText);
  if (isYType(peak)) return getYLabel(peak, text, FONT_FAMILY, measureText);
  if (isXType(peak)) return getXLabel(peak, text, FONT_FAMILY, measureText);
  return null;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════

interface OverflowResult {
  artist: string;
  type: string;
  peakIdx: number;
  fontSize: number;
  overflowPx: number;
  straightOverflowPx: number;
  overflowDir: string;
  bandHeightAtPeak: number;
  labelX: number;
  labelY: number;
  labelW: number;
  labelH: number;
}

async function main() {
  const username = process.argv[2] || 'crse';
  const preset = process.argv[3] || '3m';

  const presets: Record<string, { offsetMs: number; minPlays: number; groupBy: string }> = {
    '2w': { offsetMs: 1209600000, minPlays: 1, groupBy: 'day' },
    '3m': { offsetMs: 7776000000, minPlays: 10, groupBy: 'week' },
    '1y': { offsetMs: 31536000000, minPlays: 10, groupBy: 'week' },
  };

  const cfg = presets[preset];
  if (!cfg) { console.error('Unknown preset:', preset); process.exit(1); }

  const now = Date.now();
  const startUnix = Math.floor((now - cfg.offsetMs) / 1000);
  const endUnix = Math.floor(now / 1000);

  console.log(`Fetching data for "${username}" (${preset})...`);
  const segments = splitTimeSpan(cfg.groupBy, startUnix, endUnix);
  console.log(`  ${segments.length} time segments`);

  const segmentData: SegmentEntry[][] = [];
  for (const [from, to] of segments) {
    const data = await fetchSegment(username, from, to);
    segmentData.push(data);
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, CADENCE_MS));
  }
  console.log(` done`);

  let seriesData = joinSegments(segmentData);
  seriesData = cleanByMinPlays(seriesData, cfg.minPlays);
  console.log(`  ${seriesData.length} artists after filtering (min ${cfg.minPlays} plays)\n`);

  // ── D3 stack (exactly matches WaveVisualization.tsx) ────────────────
  const numSegments = segments.length;
  const width = numSegments * DEFAULT_WIDTH_PER_PEAK;
  const height = DEFAULT_HEIGHT;

  const keys = seriesData.map(d => d.title);
  const tableData: Record<string, number>[] = [];
  for (let i = 0; i < numSegments; i++) {
    const row: Record<string, number> = {};
    seriesData.forEach(sd => { row[sd.title] = sd.counts[i] || 0; });
    tableData.push(row);
  }

  const stack = d3.stack<Record<string, number>>()
    .keys(keys)
    .offset(d3.stackOffsetSilhouette)
    .order(d3.stackOrderNone);
  const stackedData = stack(tableData);

  const xScale = d3.scaleLinear().domain([0, numSegments - 1]).range([0, width]);
  const yMin = d3.min(stackedData, layer => d3.min(layer, d => d[0])) ?? 0;
  const yMax = d3.max(stackedData, layer => d3.max(layer, d => d[1])) ?? 0;
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

  // Area generator (same curve type as real app)
  const area = d3.area<[number, number]>()
    .x((_, i) => xScale(i))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  console.log(`Graph: ${width}×${height}px, ${keys.length} layers\n`);

  // ── Check each layer ───────────────────────────────────────────────
  const overflows: OverflowResult[] = [];

  stackedData.forEach((layer, layerIndex) => {
    const title = keys[layerIndex];
    const counts = seriesData[layerIndex].counts;

    // Build StackPoints (same as WaveVisualization lines 138-142)
    const stackPoints: StackPoint[] = layer.map((d, i) => ({
      x: xScale(i),
      y: (height - yScale(d[1])) - (height - yScale(d[0])),
      y0: height - yScale(d[0]),
    }));

    // Generate the SVG area path string
    const pathD = area(layer as any);
    if (!pathD) return;

    // Build pixel-level lookup tables for the Bezier curve boundaries
    const lut = buildBandLUT(pathD, width);
    if (!lut) return;

    // Find label indices (same as real app)
    const labelIndices = findLabelIndices(counts, MIN_SEG_BETWEEN_LABELS);

    labelIndices.forEach(idx => {
      if (idx <= 0 || idx >= stackPoints.length - 1) return;

      const peak = new Peak(idx, stackPoints);
      const type = getAlgoType(peak);
      const label = getLabel(peak, title);
      if (!label || label.fontSize < MIN_FONT_SIZE) return;

      // Get actual glyph bounds for overflow detection
      const bounds = getActualBounds(label.text, FONT_FAMILY, label.fontSize);

      // Label coords are in "inverted" space (y=0 at bottom of SVG).
      // label.xPosition = left edge of text
      // label.yPosition = baseline position (inverted)
      // In SVG coords (y=0 at top): baselineSvgY = height - yPosition
      const baselineSvgY = height - label.yPosition;
      const textLeft = Math.max(0, Math.floor(label.xPosition));
      const textRight = Math.min(width - 1, Math.ceil(label.xPosition + bounds.width));
      const textSvgTop = baselineSvgY - bounds.ascent;
      const textSvgBot = baselineSvgY + bounds.descent;

      // Sample every pixel column and check bounds against BEZIER curve
      let worstOverflow = 0;
      let worstDir = 'above';

      for (let px = textLeft; px <= textRight; px++) {
        const bandTop = lut.topY[px];   // SVG y (smaller = higher on screen)
        const bandBot = lut.botY[px];   // SVG y (larger = lower on screen)
        if (isNaN(bandTop) || isNaN(bandBot)) continue;

        const overTop = bandTop - textSvgTop;  // positive = text above band
        const overBot = textSvgBot - bandBot;  // positive = text below band

        if (overTop > worstOverflow) { worstOverflow = overTop; worstDir = 'above'; }
        if (overBot > worstOverflow) { worstOverflow = overBot; worstDir = 'below'; }
      }

      // Also check against straight-line model to distinguish
      // "algorithm bug" vs "Bezier-only overflow"
      let straightOverflow = 0;
      const topLines = [peak.A, peak.B]; // top boundary segments
      const botLines = [peak.C, peak.D]; // bottom boundary segments
      for (let px = textLeft; px <= textRight; px++) {
        // Find straight-line band boundary at this x
        let sTop = NaN, sBot = NaN;
        for (const seg of topLines) {
          if (seg.isXWithinBounds(px)) {
            const pt = seg.getPointOnLineAtX(px);
            if (pt) { sTop = height - pt.y; break; } // convert to SVG coords
          }
        }
        for (const seg of botLines) {
          if (seg.isXWithinBounds(px)) {
            const pt = seg.getPointOnLineAtX(px);
            if (pt) { sBot = height - pt.y; break; }
          }
        }
        if (isNaN(sTop) || isNaN(sBot)) continue;
        const soTop = sTop - textSvgTop;
        const soBot = textSvgBot - sBot;
        if (soTop > straightOverflow) straightOverflow = soTop;
        if (soBot > straightOverflow) straightOverflow = soBot;
      }

      if (worstOverflow > 1) {
        overflows.push({
          artist: title,
          type,
          peakIdx: idx,
          fontSize: Math.round(label.fontSize * 10) / 10,
          overflowPx: Math.round(worstOverflow * 10) / 10,
          straightOverflowPx: Math.round(straightOverflow * 10) / 10,
          overflowDir: worstDir,
          bandHeightAtPeak: Math.round(peak.top.y - peak.bottom.y),
          labelX: Math.round(label.xPosition),
          labelY: Math.round(label.yPosition),
          labelW: Math.round(bounds.width),
          labelH: Math.round(bounds.ascent + bounds.descent),
        });
      }
    });
  });

  // ── Report ─────────────────────────────────────────────────────────
  console.log('Using @napi-rs/canvas with DM Sans for accurate text metrics.');
  console.log('"Straight" column shows overflow with straight lines (algorithm issue).\n');

  if (overflows.length === 0) {
    console.log('✓ No text overflows detected.');
  } else {
    overflows.sort((a, b) => b.overflowPx - a.overflowPx);
    console.log(`⚠ Found ${overflows.length} label(s) overflowing their Bezier band:\n`);
    console.log('  Artist                      Type  Peak  Font   Bezier  Straight  Dir     BandH');
    console.log('  ' + '─'.repeat(90));
    for (const o of overflows) {
      const name = o.artist.padEnd(28);
      const type = o.type.padEnd(4);
      const peak = String(o.peakIdx).padStart(4);
      const font = (o.fontSize + 'px').padStart(6);
      const bezier = (o.overflowPx + 'px').padStart(7);
      const straight = (o.straightOverflowPx > 0 ? o.straightOverflowPx + 'px' : '—').padStart(8);
      const dir = o.overflowDir.padEnd(7);
      const bh = (o.bandHeightAtPeak + 'px').padStart(5);
      console.log(`  ${name}  ${type} ${peak} ${font}  ${bezier}  ${straight}  ${dir}  ${bh}`);
    }

    // Categorize
    const bezierOnly = overflows.filter(o => o.straightOverflowPx <= 1);
    const algoIssues = overflows.filter(o => o.straightOverflowPx > 1);
    if (bezierOnly.length > 0) {
      console.log(`\n  Bezier-curve-only overflows (${bezierOnly.length}): text fits straight lines but not curves`);
      for (const o of bezierOnly) {
        console.log(`    ${o.artist} (peak ${o.peakIdx}): ${o.overflowPx}px ${o.overflowDir}`);
      }
    }
    if (algoIssues.length > 0) {
      console.log(`\n  Algorithm issues (${algoIssues.length}): text overflows even with straight lines`);
      for (const o of algoIssues) {
        console.log(`    ${o.artist} (peak ${o.peakIdx}): ${o.straightOverflowPx}px straight + ${Math.max(0, o.overflowPx - o.straightOverflowPx).toFixed(1)}px from curves`);
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
