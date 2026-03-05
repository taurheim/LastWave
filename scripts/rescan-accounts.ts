/**
 * Re-scan last.fm accounts for Bezier-only text overflows using accurate canvas metrics.
 * Outputs StackPoint data ready to paste into sliceData.ts.
 *
 * Usage: npx tsx scripts/rescan-accounts.ts
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

// ── Constants ────────────────────────────────────────────────────────
const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const CADENCE_MS = 120;
const DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH_PER_PEAK = 150;
const MIN_FONT_SIZE = 8;
const MIN_SEG_BETWEEN_LABELS = 3;
const FONT_FAMILY = 'DM Sans';

// ── Register DM Sans ─────────────────────────────────────────────────
const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const fontPath = path.resolve(scriptDir, '../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff');
GlobalFonts.registerFromPath(fontPath, 'DM Sans');

const _canvas = createCanvas(1, 1);
const _ctx = _canvas.getContext('2d');

const measureText: MeasureTextFn = (text: string, font: string, fontSize: number) => {
  _ctx.font = `${fontSize}px ${font}`;
  const m = _ctx.measureText(text);
  return { width: m.width, height: fontSize * 1.2, slope: (fontSize * 1.2) / m.width };
};

function getActualBounds(text: string, font: string, fontSize: number) {
  _ctx.font = `${fontSize}px ${font}`;
  const m = _ctx.measureText(text);
  return { width: m.width, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
}

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

// ── SVG path parsing ─────────────────────────────────────────────────
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
      const [p1x, p1y, p2x, p2y, p3x, p3y] = args;
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

function buildBandLUT(areaPathD: string, width: number) {
  const cmds = parsePath(areaPathD);
  let splitIdx = -1;
  for (let i = 1; i < cmds.length; i++) {
    if (cmds[i].cmd === 'L') { splitIdx = i; break; }
  }
  if (splitIdx < 0) return null;
  const topCmds = cmds.slice(0, splitIdx);
  const botCmds = [{ cmd: 'M', args: cmds[splitIdx].args }, ...cmds.slice(splitIdx + 1).filter(c => c.cmd !== 'Z')];
  const topPathD = topCmds.map(c => c.cmd + c.args.join(',')).join('');
  const botPathD = botCmds.map(c => c.cmd + c.args.join(',')).join('');
  return { topY: buildCurveLUT(topPathD, width), botY: buildCurveLUT(botPathD, width) };
}

// ── Algo ─────────────────────────────────────────────────────────────
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

// ── Scan one account ─────────────────────────────────────────────────
interface OverflowCase {
  user: string;
  artist: string;
  type: string;
  peakIdx: number;
  fontSize: number;
  overflowPx: number;
  straightOverflowPx: number;
  overflowDir: string;
  bandHeight: number;
  points: StackPoint[];
  numSegments: number;
}

async function scanAccount(
  username: string,
  preset: string,
): Promise<OverflowCase[]> {
  const presets: Record<string, { offsetMs: number; minPlays: number; groupBy: string }> = {
    '2w': { offsetMs: 1209600000, minPlays: 1, groupBy: 'day' },
    '3m': { offsetMs: 7776000000, minPlays: 10, groupBy: 'week' },
    '1y': { offsetMs: 31536000000, minPlays: 10, groupBy: 'week' },
  };
  const cfg = presets[preset]!;
  const now = Date.now();
  const startUnix = Math.floor((now - cfg.offsetMs) / 1000);
  const endUnix = Math.floor(now / 1000);
  const segments = splitTimeSpan(cfg.groupBy, startUnix, endUnix);

  const segmentData: SegmentEntry[][] = [];
  for (const [from, to] of segments) {
    const data = await fetchSegment(username, from, to);
    segmentData.push(data);
    await new Promise(r => setTimeout(r, CADENCE_MS));
  }

  let seriesData = joinSegments(segmentData);
  seriesData = cleanByMinPlays(seriesData, cfg.minPlays);
  if (seriesData.length < 3) return [];

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

  const area = d3.area<[number, number]>()
    .x((_, i) => xScale(i))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  const results: OverflowCase[] = [];

  stackedData.forEach((layer, layerIndex) => {
    const title = keys[layerIndex];
    const counts = seriesData[layerIndex].counts;

    const stackPoints: StackPoint[] = layer.map((d, i) => ({
      x: xScale(i),
      y: (height - yScale(d[1])) - (height - yScale(d[0])),
      y0: height - yScale(d[0]),
    }));

    const pathD = area(layer as any);
    if (!pathD) return;
    const lut = buildBandLUT(pathD, width);
    if (!lut) return;

    const labelIndices = findLabelIndices(counts, MIN_SEG_BETWEEN_LABELS);
    labelIndices.forEach(idx => {
      if (idx <= 0 || idx >= stackPoints.length - 1) return;
      const peak = new Peak(idx, stackPoints);
      const type = getAlgoType(peak);
      const label = getLabel(peak, title);
      if (!label || label.fontSize < MIN_FONT_SIZE) return;
      if (!isFinite(label.xPosition) || !isFinite(label.yPosition)) return;

      const bounds = getActualBounds(label.text, FONT_FAMILY, label.fontSize);
      const baselineSvgY = height - label.yPosition;
      const textLeft = Math.max(0, Math.floor(label.xPosition));
      const textRight = Math.min(width - 1, Math.ceil(label.xPosition + bounds.width));
      const textSvgTop = baselineSvgY - bounds.ascent;
      const textSvgBot = baselineSvgY + bounds.descent;

      let worstOverflow = 0;
      let worstDir = 'above';
      for (let px = textLeft; px <= textRight; px++) {
        const bandTop = lut.topY[px];
        const bandBot = lut.botY[px];
        if (isNaN(bandTop) || isNaN(bandBot)) continue;
        const overTop = bandTop - textSvgTop;
        const overBot = textSvgBot - bandBot;
        if (overTop > worstOverflow) { worstOverflow = overTop; worstDir = 'above'; }
        if (overBot > worstOverflow) { worstOverflow = overBot; worstDir = 'below'; }
      }

      // Straight-line check
      let straightOverflow = 0;
      const topLines = [peak.A, peak.B];
      const botLines = [peak.C, peak.D];
      for (let px = textLeft; px <= textRight; px++) {
        let sTop = NaN, sBot = NaN;
        for (const seg of topLines) {
          if (seg.isXWithinBounds(px)) { const pt = seg.getPointOnLineAtX(px); if (pt) { sTop = height - pt.y; break; } }
        }
        for (const seg of botLines) {
          if (seg.isXWithinBounds(px)) { const pt = seg.getPointOnLineAtX(px); if (pt) { sBot = height - pt.y; break; } }
        }
        if (isNaN(sTop) || isNaN(sBot)) continue;
        const soTop = sTop - textSvgTop;
        const soBot = textSvgBot - sBot;
        if (soTop > straightOverflow) straightOverflow = soTop;
        if (soBot > straightOverflow) straightOverflow = soBot;
      }

      // Only keep Bezier-only overflows (> 1px and straight ≤ 1px)
      if (worstOverflow > 1 && straightOverflow <= 1) {
        results.push({
          user: username,
          artist: title,
          type,
          peakIdx: idx,
          fontSize: Math.round(label.fontSize * 10) / 10,
          overflowPx: Math.round(worstOverflow * 10) / 10,
          straightOverflowPx: Math.round(straightOverflow * 10) / 10,
          overflowDir: worstDir,
          bandHeight: Math.round(peak.top.y - peak.bottom.y),
          points: stackPoints,
          numSegments,
        });
      }
    });
  });

  return results;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════
async function main() {
  // Original 20+ accounts + taurheim + crse
  const accounts = [
    { user: 'crse', preset: '3m' },
    { user: 'taurheim', preset: '3m' },
    { user: 'RJ', preset: '3m' },
    { user: 'Maddieman', preset: '3m' },
    { user: 'sjlver', preset: '3m' },
    { user: 'Archerist', preset: '3m' },
    { user: 'bananaman_', preset: '3m' },
    { user: 'Ksjzk', preset: '3m' },
    { user: 'Holsjansen', preset: '3m' },
    { user: 'Joda09', preset: '3m' },
    { user: 'ericzero', preset: '3m' },
    { user: 'Lunar_Friend', preset: '3m' },
    { user: 'xmskx', preset: '3m' },
    { user: 'hegemonster', preset: '3m' },
    { user: 'musicpsych', preset: '3m' },
    { user: 'benny_bansen', preset: '3m' },
    { user: 'Drsjjw', preset: '3m' },
    { user: 'Mysjansen', preset: '3m' },
    { user: 'mathijs614', preset: '3m' },
    { user: 'Svansen', preset: '3m' },
    { user: 'Jeanmuansen', preset: '3m' },
    { user: 'totemator', preset: '3m' },
  ];

  const allOverflows: OverflowCase[] = [];

  for (const { user, preset } of accounts) {
    process.stdout.write(`Scanning ${user} (${preset})... `);
    try {
      const cases = await scanAccount(user, preset);
      console.log(`${cases.length} Bezier-only overflow(s)`);
      allOverflows.push(...cases);
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Total Bezier-only overflows: ${allOverflows.length}`);
  console.log(`${'='.repeat(80)}\n`);

  if (allOverflows.length === 0) {
    console.log('No Bezier-only overflows found.');
    return;
  }

  // Sort by overflow amount (worst first)
  allOverflows.sort((a, b) => b.overflowPx - a.overflowPx);

  // Summary table
  console.log('  User             Artist                      Type  Peak  Font   Overflow  Dir     BandH');
  console.log('  ' + '─'.repeat(95));
  for (const o of allOverflows) {
    const usr = o.user.padEnd(16);
    const name = o.artist.padEnd(28);
    const type = o.type.padEnd(4);
    const peak = String(o.peakIdx).padStart(4);
    const font = (o.fontSize + 'px').padStart(6);
    const overflow = (o.overflowPx + 'px').padStart(8);
    const dir = o.overflowDir.padEnd(7);
    const bh = (o.bandHeight + 'px').padStart(5);
    console.log(`  ${usr} ${name}  ${type} ${peak} ${font}  ${overflow}  ${dir}  ${bh}`);
  }

  // Output top 20 as sliceData entries
  const top = allOverflows.slice(0, 20);
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`Top ${top.length} worst Bezier-only overflows — sliceData.ts entries:`);
  console.log(`${'='.repeat(80)}\n`);

  top.forEach((o, i) => {
    const id = `scan${String(i + 1).padStart(2, '0')}`;
    console.log(`  // ${o.user}: ${o.artist} — ${o.type}-type, ${o.overflowPx}px Bezier overflow, ${o.bandHeight}px band`);
    console.log(`  {`);
    console.log(`    id: '${id}', label: '${o.artist.replace(/'/g, "\\'")}',`);
    console.log(`    description: '${o.user}: ${o.type}-type peak at idx ${o.peakIdx}, ${o.overflowPx}px overflow',`);
    console.log(`    peakIndex: ${o.peakIdx},`);
    console.log(`    points: [`);
    o.points.forEach((p, j) => {
      const comma = j < o.points.length - 1 ? ',' : '';
      console.log(`      { x: ${Math.round(p.x * 10) / 10}, y: ${Math.round(p.y * 10) / 10}, y0: ${Math.round(p.y0 * 10) / 10} }${comma}`);
    });
    console.log(`    ],`);
    console.log(`  },\n`);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
