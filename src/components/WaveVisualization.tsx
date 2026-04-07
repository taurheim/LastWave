import { useRef, useEffect, memo } from 'react';
import * as d3 from 'd3';
import type SeriesData from '@/core/models/SeriesData';
import { useLastWaveStore, type ColorScheme } from '@/store/index';
import schemes from '@/core/config/schemes.json';
import { findLabelIndices, createCanvasMeasurer } from '@/core/wave/util';
import { findOptimalLabel } from '@/core/wave/bezierFit';
import { computeDeformedText } from '@/core/wave/deformText';
import { buildBandLUT } from '@/core/wave/overflowDetection';
import type { OverflowInfo } from '@/core/wave/overflowDetection';
import { stackOrderSlopeBalanced } from '@/core/wave/stackOrder';
import Peak from '@/core/models/Peak';
import type { StackPoint } from '@/core/models/Peak';
import FontData from '@/core/models/FontData';
import type Label from '@/core/models/Label';

const DEFAULT_WIDTH_PER_PEAK = 150;
const DEFAULT_HEIGHT = 550;
const MINIMUM_SEGMENTS_BETWEEN_LABELS = 3;
const MINIMUM_FONT_SIZE_PIXELS = 8;
// Toggle for text placement debug markers (red dots at each label's center point).
// Enable when tuning deformed text sizing or centering. See .github/skills/wave-text-tuning/
const DEBUG_CENTER_DOTS = false;

const OFFSET_MAP: Record<
  string,
  (series: d3.Series<Record<string, number>, string>, order: number[]) => void
> = {
  balanced: d3.stackOffsetSilhouette,
  silhouette: d3.stackOffsetSilhouette,
  wiggle: d3.stackOffsetWiggle,
  expand: d3.stackOffsetExpand,
  zero: d3.stackOffsetNone,
};

// Hash a string to a stable unsigned 32-bit integer.
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Parse "#RRGGBB" to [r, g, b].
function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

// Weighted Euclidean RGB distance — approximates perceptual difference.
// Uses Compuphase's redmean formula for cheap perceptual weighting.
function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

// Threshold below which two colors are considered "too similar" to be adjacent.
const COLOR_SIMILARITY_THRESHOLD = 60;

// Assign colors to stacked layers.
// Each artist gets a stable color from a hash of its name (survives animation).
// When `fixAdjacency` is true (final render), a post-pass shifts any visually
// adjacent bands that ended up with the same color — including non-stack-neighbors
// that can touch when intermediate bands go to zero.
function assignStackColors(
  keys: string[],
  colors: string[],
  fixAdjacency = false,
  tableData?: Record<string, number>[],
): Map<string, string> {
  const n = colors.length;
  const stride = Math.max(1, Math.round(n * 0.618));
  const map = new Map<string, string>();

  // Initial assignment: hash-based with golden-ratio stride for good spread
  for (const key of keys) {
    map.set(key, colors[Math.abs(hashString(key) * stride) % n]);
  }

  // Fix adjacent duplicates: ensure no two visually-adjacent bands share a color.
  // "Visually adjacent" means either direct stack neighbors OR bands that can
  // touch because all bands between them are zero at some time segment.
  if (fixAdjacency && n >= 2) {
    // Build conflict set: for each band, which other bands must differ in color
    const conflicts = new Map<number, Set<number>>();
    for (let i = 0; i < keys.length; i++) conflicts.set(i, new Set());

    // Direct stack neighbors always conflict
    for (let i = 0; i < keys.length - 1; i++) {
      conflicts.get(i)!.add(i + 1);
      conflicts.get(i + 1)!.add(i);
    }

    // Scan data for visual adjacency: when intermediate bands are all zero,
    // the two non-zero bands on either side visually touch
    if (tableData) {
      for (const row of tableData) {
        // Find indices of bands with non-zero values at this time segment
        const nonZero: number[] = [];
        for (let i = 0; i < keys.length; i++) {
          if ((row[keys[i]] ?? 0) > 0) nonZero.push(i);
        }
        // Consecutive non-zero bands in the stack are visually adjacent
        for (let k = 0; k < nonZero.length - 1; k++) {
          const a = nonZero[k], b = nonZero[k + 1];
          conflicts.get(a)!.add(b);
          conflicts.get(b)!.add(a);
        }
      }
    }

    // Greedy recolor: for each band, if its color is too similar to any visual
    // neighbor's color, pick the most perceptually distinct alternative
    for (let i = 0; i < keys.length; i++) {
      const neighborColors: string[] = [];
      for (const j of conflicts.get(i)!) {
        neighborColors.push(map.get(keys[j])!);
      }
      const myColor = map.get(keys[i])!;
      const tooSimilar = neighborColors.some(
        (nc) => colorDistance(myColor, nc) < COLOR_SIMILARITY_THRESHOLD,
      );
      if (tooSimilar) {
        // Pick the color with the greatest minimum distance to all neighbors
        let bestColor = myColor;
        let bestMinDist = 0;
        for (let offset = 1; offset < n; offset++) {
          const candidate = colors[(colors.indexOf(myColor) + offset) % n];
          const minDist = Math.min(...neighborColors.map((nc) => colorDistance(candidate, nc)));
          if (minDist > bestMinDist) {
            bestMinDist = minDist;
            bestColor = candidate;
          }
        }
        map.set(keys[i], bestColor);
      }
    }
  }

  return map;
}

interface WaveVisualizationProps {
  seriesData: SeriesData[];
  onOverflowsDetected?: (overflows: OverflowInfo[]) => void;
  onRenderComplete?: () => void;
  onDrawingProgress?: (status: string) => void;
  lockedYDomain?: [number, number];
  lockedColorMap?: Map<string, string>;
  suppressLabels?: boolean;
}

export default memo(function WaveVisualization({
  seriesData,
  onOverflowsDetected,
  onRenderComplete,
  onDrawingProgress,
  lockedYDomain,
  lockedColorMap,
  suppressLabels,
}: WaveVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const deformAbortRef = useRef(0);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const username = useLastWaveStore((s) => s.dataSourceOptions.username);
  const timeStart = useLastWaveStore((s) => s.dataSourceOptions.time_start);
  const timeEnd = useLastWaveStore((s) => s.dataSourceOptions.time_end);

  // Auto-enable year labels when time range >= 1 year
  const isYearRange = (() => {
    if (!timeStart || !timeEnd) return false;
    const startMs =
      timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart as string).getTime();
    const endMs =
      timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd as string).getTime();
    if (isNaN(startMs) || isNaN(endMs)) return false;
    return endMs - startMs >= 365 * 24 * 60 * 60 * 1000;
  })();

  useEffect(() => {
    if (!svgRef.current) return;
    const abortId = ++deformAbortRef.current; // cancel any in-flight deformed text render

    const svg = d3.select(svgRef.current);

    const schemeName = (rendererOptions.color_scheme ?? 'lastwave') as keyof typeof schemes;
    const scheme: ColorScheme =
      (schemes as Record<string, ColorScheme>)[schemeName] ?? schemes.lastwave;
    const colors = scheme.schemeColors;
    const isDark = document.documentElement.classList.contains('dark');

    // Themes with backgroundColorLight adapt to system dark/light mode
    const bgColor: string =
      !isDark && scheme.backgroundColorLight ? scheme.backgroundColorLight : scheme.backgroundColor;

    const height = rendererOptions.height ? parseInt(rendererOptions.height, 10) : DEFAULT_HEIGHT;

    // When no data yet, render just the background so the chart area is visible immediately
    if (seriesData.length === 0) {
      svg.selectAll('*').remove();
      const userWidth = rendererOptions.width ? parseInt(rendererOptions.width, 10) : 0;
      const placeholderWidth = userWidth > 0 ? userWidth : 13 * DEFAULT_WIDTH_PER_PEAK;
      svg
        .attr('width', placeholderWidth)
        .attr('height', height)
        .attr('viewBox', `0 0 ${placeholderWidth} ${height}`);
      svg
        .append('rect')
        .attr('width', placeholderWidth)
        .attr('height', height)
        .attr('fill', bgColor);
      return;
    }

    const fontColor: string =
      !isDark && scheme.fontColorLight ? scheme.fontColorLight : scheme.fontColor;
    const fontFamily = rendererOptions.font ?? 'DM Sans';
    const offsetName = rendererOptions.offset ?? 'balanced';
    const offsetFn = OFFSET_MAP[offsetName] ?? d3.stackOffsetSilhouette;
    const addLabels = !suppressLabels && (rendererOptions.add_labels ?? true);
    const deformText = rendererOptions.deform_text ?? true;
    const jitterText = true;
    const stackJitter = parseFloat(rendererOptions.stack_jitter as string) || 0.15;

    // Determine dimensions
    const numSegments = seriesData[0]?.counts.length ?? 0;
    const userWidth = rendererOptions.width ? parseInt(rendererOptions.width, 10) : 0;
    const width = userWidth > 0 ? userWidth : numSegments * DEFAULT_WIDTH_PER_PEAK;

    // Pivot data: from SeriesData[] to tabular format for d3.stack
    const keys = seriesData.map((s) => s.title);
    const tableData: Record<string, number>[] = [];
    for (let i = 0; i < numSegments; i++) {
      const row: Record<string, number> = { index: i };
      seriesData.forEach((s) => {
        row[s.title] = s.counts[i] ?? 0;
      });
      tableData.push(row);
    }

    // D3 stack — "balanced" mode uses custom slope-balanced ordering;
    // "silhouette" uses insideOut so new artists appear on both sides;
    // all other modes use the default input order.
    // During animation (suppressLabels), use jitter=1 so ordering is purely
    // hash-based and completely stable — no data-dependent reordering that
    // would cause bands to visually jump between frames.
    const balancedJitter = suppressLabels ? 1.0 : stackJitter;
    const orderFn =
      offsetName === 'balanced'
        ? (s: d3.Series<Record<string, number>, string>[]) => stackOrderSlopeBalanced(s, balancedJitter)
        : offsetName === 'silhouette'
          ? d3.stackOrderInsideOut
          : d3.stackOrderNone;
    const stack = d3
      .stack<Record<string, number>>()
      .keys(keys)
      .offset(offsetFn)
      .order(orderFn);

    const stackedData = stack(tableData);

    // Use prominence-aware locked color map when available (during animation).
    // Fall back to hash-based assignment for final render or non-balanced modes.
    const colorKeys = offsetName === 'balanced' ? stackedData.map((layer) => layer.key) : keys;
    const fixAdj = !suppressLabels;
    const colorMap = lockedColorMap && lockedColorMap.size > 0
      ? lockedColorMap
      : assignStackColors(colorKeys, colors, fixAdj, tableData);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, numSegments - 1])
      .range([0, width]);

    const yMin = lockedYDomain?.[0] ?? (d3.min(stackedData, (layer) => d3.min(layer, (d) => d[0])) ?? 0);
    const yMax = lockedYDomain?.[1] ?? (d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1])) ?? 0);
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    // Area generator
    const area = d3
      .area<[number, number]>()
      .x((_, i) => xScale(i))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    // During animation (suppressLabels), do a fast render: paths + static text, no artist labels.
    // Uses incremental updates instead of full teardown so D3 can smoothly morph paths.
    if (suppressLabels) {
      // Fast path: full teardown + rebuild of waves, but skip text labels.
      // This avoids DOM ordering issues where bg rect could paint over paths.
      svg.selectAll('*').remove();
      svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

      // Background — transparent during animation so page background shows through
      svg.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', 'transparent');

      const fontColor: string =
        !isDark && scheme.fontColorLight ? scheme.fontColorLight : scheme.fontColor;
      const fontFamily = rendererOptions.font ?? 'DM Sans';
      const addMonths = rendererOptions.add_months ?? true;
      const addYears = rendererOptions.add_years ?? isYearRange;
      const showWatermark = rendererOptions.show_watermark ?? true;

      // Year separator lines
      if (addYears && timeStart && timeEnd) {
        const startMs =
          timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart).getTime();
        const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd).getTime();
        const timePerSegment = (endMs - startMs) / numSegments;
        let lastYear = -1;
        for (let i = 0; i < numSegments; i++) {
          const segDate = new Date(startMs + i * timePerSegment);
          const year = segDate.getFullYear();
          if (year !== lastYear) {
            if (lastYear !== -1) {
              svg
                .append('line')
                .attr('class', 'year-sep')
                .attr('x1', xScale(i))
                .attr('y1', 0)
                .attr('x2', xScale(i))
                .attr('y2', height)
                .attr('stroke', fontColor)
                .attr('stroke-opacity', 0.12)
                .attr('stroke-width', 2);
            }
            lastYear = year;
          }
        }
      }

      // Wave paths
      svg
        .selectAll<SVGPathElement, d3.Series<Record<string, number>, string>>('path.wave')
        .data(stackedData, (d) => d.key)
        .join('path')
        .attr('class', 'wave')
        .attr('d', (d) => area(d as [number, number][]) ?? '')
        .attr('fill', (d) => colorMap.get(d.key) ?? colors[0])
        .attr('stroke', 'none');

      // Overlays (months, years, watermark)
      if (addMonths && timeStart && timeEnd) {
        const startMs =
          timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart).getTime();
        const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd).getTime();
        const timePerSegment = (endMs - startMs) / numSegments;
        const monthNames = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        let lastMonth = -1;
        for (let i = 0; i < numSegments; i++) {
          const segDate = new Date(startMs + i * timePerSegment);
          const month = segDate.getMonth();
          if (month !== lastMonth) {
            lastMonth = month;
            svg
              .append('text')
              .attr('class', 'anim-overlay')
              .attr('x', xScale(i))
              .attr('y', height - 5)
              .attr('font-size', '10px')
              .attr('font-family', fontFamily)
              .attr('fill', fontColor)
              .text(monthNames[month]);
          }
        }
      }

      if (addYears && timeStart && timeEnd) {
        const startMs =
          timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart).getTime();
        const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd).getTime();
        const timePerSegment = (endMs - startMs) / numSegments;
        let lastYear = -1;
        for (let i = 0; i < numSegments; i++) {
          const segDate = new Date(startMs + i * timePerSegment);
          const year = segDate.getFullYear();
          if (year !== lastYear) {
            lastYear = year;
            svg
              .append('text')
              .attr('class', 'anim-overlay')
              .attr('x', xScale(i) + (i > 0 ? 4 : 0))
              .attr('y', 15)
              .attr('font-size', '12px')
              .attr('font-family', fontFamily)
              .attr('fill', fontColor)
              .attr('font-weight', 'bold')
              .text(String(year));
          }
        }
      }

      if (showWatermark) {
        svg
          .append('text')
          .attr('class', 'anim-overlay')
          .attr('x', width - 5)
          .attr('y', height - 5)
          .attr('text-anchor', 'end')
          .attr('font-size', '14px')
          .attr('font-family', fontFamily)
          .attr('fill', fontColor)
          .attr('opacity', 0.5)
          .text('lastwave');
      }

      return;
    }

    // Full rebuild (final render with labels)
    svg.selectAll('*').remove();

    // Set SVG attributes
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    // Background
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', bgColor);

    // Year separator lines (behind wave paths)
    if ((rendererOptions.add_years ?? isYearRange) && timeStart && timeEnd) {
      const startMs =
        timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart as string).getTime();
      const endMs =
        timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd as string).getTime();
      const timePerSegment = (endMs - startMs) / numSegments;
      let lastYear = -1;
      for (let i = 0; i < numSegments; i++) {
        const segDate = new Date(startMs + i * timePerSegment);
        const year = segDate.getFullYear();
        if (year !== lastYear) {
          if (lastYear !== -1) {
            svg
              .append('line')
              .attr('x1', xScale(i))
              .attr('y1', 0)
              .attr('x2', xScale(i))
              .attr('y2', height)
              .attr('stroke', fontColor)
              .attr('stroke-opacity', 0.12)
              .attr('stroke-width', 2);
          }
          lastYear = year;
        }
      }
    }

    // Embed font in SVG so text renders when downloaded/viewed standalone
    const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, '+')}&display=swap`;
    const defs = svg.append('defs');
    defs.append('style').text(`@import url('${fontUrl}');`);

    // Draw paths — capture path strings for overflow detection (keyed by series
    // title so lookup is immune to any DOM vs data ordering differences).
    const pathByKey: Record<string, string> = {};
    svg
      .selectAll<SVGPathElement, d3.Series<Record<string, number>, string>>('path.wave')
      .data(stackedData, (d) => d.key)
      .join('path')
      .attr('class', 'wave')
      .attr('d', (d) => {
        const pathD = area(d as [number, number][]) ?? '';
        pathByKey[d.key] = pathD;
        return pathD;
      })
      .attr('fill', (d) => colorMap.get(d.key) ?? colors[0])
      .attr('stroke', 'none')
      .attr('stroke-width', 0);

    // Add text labels using wave algorithms
    const detectedOverflows: OverflowInfo[] = [];
    if (addLabels) {
      const measureText = createCanvasMeasurer();
      const fontData = new FontData(fontFamily, fontColor);

      if (deformText) {
        // ── Deformed text: async rendering to avoid blocking the main thread ──
        // Collect all label work items first, then process them in batches
        // with frame yields so the UI stays responsive.
        type DeformJob = {
          label: Label;
          layer: (readonly [number, number])[];
          layerIndex: number;
          stackPoints: StackPoint[];
          idx: number;
          pathD: string;
        };
        const jobs: DeformJob[] = [];

        stackedData.forEach((layer, layerIndex) => {
          const seriesTitle = keys[layerIndex];
          const counts = seriesData[layerIndex].counts;
          const stackPoints: StackPoint[] = layer.map((d, i) => ({
            x: xScale(i),
            y: height - yScale(d[1]) - (height - yScale(d[0])),
            y0: height - yScale(d[0]),
          }));

          const pathD = pathByKey[seriesTitle] ?? '';
          const labelIndices = findLabelIndices(counts, MINIMUM_SEGMENTS_BETWEEN_LABELS);
          labelIndices.forEach((idx) => {
            const peak = new Peak(idx, stackPoints);
            let label: Label | null = null;
            label = findOptimalLabel(
              peak,
              seriesTitle,
              fontData.family,
              measureText,
              stackPoints,
              idx,
            );
            if (label && label.fontSize >= MINIMUM_FONT_SIZE_PIXELS) {
              jobs.push({
                label,
                layer: layer as (readonly [number, number])[],
                layerIndex,
                stackPoints,
                idx,
                pathD,
              });
            }
          });
        });

        // Process deform jobs in batches, yielding between batches
        const BATCH_SIZE = 8;
        let jobIndex = 0;
        // Track unique artists for progress display
        const uniqueArtists = [...new Set(jobs.map((j) => j.label.text))];
        const artistsDone = new Set<string>();
        // Track rendered x-ranges per artist to prevent visual overlap
        const artistRanges = new Map<string, Array<[number, number]>>();

        function processBatch() {
          if (abortId !== deformAbortRef.current) return; // effect re-ran, abort
          const end = Math.min(jobIndex + BATCH_SIZE, jobs.length);

          for (; jobIndex < end; jobIndex++) {
            const { label, layer, stackPoints, idx, pathD } = jobs[jobIndex];
            artistsDone.add(label.text);

            const bandData = layer.map((d: readonly [number, number], i: number) => ({
              x: xScale(i),
              topY: yScale(d[1]),
              botY: yScale(d[0]),
              centerY: (yScale(d[0]) + yScale(d[1])) / 2,
              thickness: yScale(d[0]) - yScale(d[1]),
            }));

            // Build Bezier-accurate band bounds from the actual SVG path
            // (bandAtX uses linear interpolation which overestimates thickness)
            const bandLUT = pathD ? buildBandLUT(pathD, width) : null;
            const bandBoundsAtX = bandLUT
              ? (x: number) => {
                  const px = Math.round(x);
                  const b = px >= 0 && px < bandLUT.length ? bandLUT[px] : null;
                  if (b) return { topY: b.top, botY: b.bot, thickness: b.bot - b.top };
                  // Fallback to linear interpolation
                  const bandXStep = bandData.length > 1 ? bandData[1].x - bandData[0].x : 1;
                  const fi = (x - bandData[0].x) / bandXStep;
                  const i = Math.max(0, Math.min(bandData.length - 2, Math.floor(fi)));
                  const t = Math.max(0, Math.min(1, fi - i));
                  return {
                    topY: bandData[i].topY * (1 - t) + bandData[i + 1].topY * t,
                    botY: bandData[i].botY * (1 - t) + bandData[i + 1].botY * t,
                    thickness: bandData[i].thickness * (1 - t) + bandData[i + 1].thickness * t,
                  };
                }
              : undefined;

            const result = computeDeformedText(
              label,
              bandData,
              idx,
              stackPoints[idx].x,
              fontData.family,
              measureText,
              bandBoundsAtX,
              jitterText,
            );

            // Skip if this label's deformed text is too close to a previous label for the same artist
            // (require at least 1 segment width gap between same-artist labels)
            const visiblePlacements = result.placements.filter(
              (p) => p.fontSize >= 4 && p.opacity > 0,
            );
            if (visiblePlacements.length > 0) {
              const minX = visiblePlacements[0].x;
              const maxX = visiblePlacements[visiblePlacements.length - 1].x;
              const segWidth = numSegments > 1 ? width / (numSegments - 1) : width;
              const prevRanges = artistRanges.get(label.text);
              if (prevRanges) {
                // Check if any previous label for this artist is within 1 segment width
                const tooClose = prevRanges.some(
                  ([lo, hi]) => minX <= hi + segWidth && maxX >= lo - segWidth,
                );
                if (tooClose) continue;
              }
              if (!artistRanges.has(label.text)) artistRanges.set(label.text, []);
              artistRanges.get(label.text)!.push([minX, maxX]);
            }

            for (const p of result.placements) {
              if (p.fontSize < 4 || p.opacity <= 0) continue;
              const tx = `translate(${p.x}, ${p.y}) rotate(${p.angle}) scale(1, ${p.scaleY.toFixed(3)})`;
              svg
                .append('text')
                .attr('font-size', `${p.fontSize}px`)
                .attr('font-family', fontData.family)
                .attr('font-weight', 400)
                .attr('fill', fontData.color)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('transform', tx)
                .attr('opacity', p.opacity)
                .text(p.ch);
            }

            // DEBUG: draw center marker when DEBUG_CENTER_DOTS is enabled
            if (DEBUG_CENTER_DOTS && result.debugCenterX != null && result.debugCenterY != null) {
              svg
                .append('circle')
                .attr('cx', result.debugCenterX)
                .attr('cy', result.debugCenterY)
                .attr('r', 5)
                .attr('fill', 'red')
                .attr('opacity', 0.9);
            }
          }

          if (jobIndex < jobs.length) {
            onDrawingProgress?.(`Placing text ${artistsDone.size}/${uniqueArtists.length}…`);
            requestAnimationFrame(processBatch);
          } else {
            onRenderComplete?.();
          }
        }

        if (jobs.length > 0) {
          onDrawingProgress?.(`Placing text 0/${uniqueArtists.length}…`);
          // Defer first batch so React can paint the "Placing text…" indicator
          requestAnimationFrame(processBatch);
        } else {
          onRenderComplete?.();
        }
      } else {
        // ── Normal horizontal text rendering ──
        stackedData.forEach((layer, layerIndex) => {
          const seriesTitle = keys[layerIndex];
          const counts = seriesData[layerIndex].counts;
          const stackPoints: StackPoint[] = layer.map((d, i) => ({
            x: xScale(i),
            y: height - yScale(d[1]) - (height - yScale(d[0])),
            y0: height - yScale(d[0]),
          }));

          const labelIndices = findLabelIndices(counts, MINIMUM_SEGMENTS_BETWEEN_LABELS);
          labelIndices.forEach((idx) => {
            const peak = new Peak(idx, stackPoints);
            let label: Label | null = null;
            label = findOptimalLabel(
              peak,
              seriesTitle,
              fontData.family,
              measureText,
              stackPoints,
              idx,
            );

            if (label && label.fontSize >= MINIMUM_FONT_SIZE_PIXELS) {
              const dims = measureText(label.text, fontData.family, label.fontSize);
              const textW = dims.width;

              if (label.xPosition < 0 || label.xPosition + textW > width) {
                return;
              }

              // Edge check: hide labels that cover an edge data point
              // where the band is thin. Use ceil() for leftIdx to avoid
              // including interior data points far from the text start
              // (which falsely caught labels like Daft Punk at x=140 via
              // floor(0.86)=0). ceil() includes the next outward point.
              const textH = label.fontSize * 1.2;
              const numPts = stackPoints.length;
              const edgeMargin = Math.max(2, Math.ceil(numPts * 0.1));
              const leftIdx = Math.max(0, Math.ceil((label.xPosition * (numPts - 1)) / width));
              const rightIdx = Math.min(
                numPts - 1,
                Math.ceil(((label.xPosition + textW) * (numPts - 1)) / width),
              );
              let tooThin = false;
              for (let i = leftIdx; i <= rightIdx; i++) {
                const atEdge = i < edgeMargin || i >= numPts - edgeMargin;
                if (atEdge && stackPoints[i].y < textH) {
                  tooThin = true;
                  break;
                }
              }
              if (tooThin) return;

              svg
                .append('text')
                .attr('x', label.xPosition)
                .attr('y', height - label.yPosition)
                .attr('font-size', `${label.fontSize}px`)
                .attr('font-family', fontData.family)
                .attr('fill', fontData.color)
                .text(label.text);
            }
          });
        });
      }
    }
    // For non-deform or no-labels cases, signal render complete synchronously.
    // (Deform text calls onRenderComplete from its async processBatch loop.)
    if (!addLabels || !deformText) {
      onRenderComplete?.();
    }

    onOverflowsDetected?.(detectedOverflows);
  }, [
    seriesData,
    rendererOptions.color_scheme,
    rendererOptions.font,
    rendererOptions.offset,
    rendererOptions.width,
    rendererOptions.height,
    rendererOptions.add_labels,
    rendererOptions.deform_text,
    rendererOptions.stack_jitter,
    suppressLabels,
    lockedYDomain,
    lockedColorMap,
  ]);

  // ── Overlay effect: cheap decorations that can toggle without re-rendering waves+labels ──
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Remove only the overlay group (not the entire SVG)
    svg.selectAll('.overlays').remove();
    const overlayG = svg.append('g').attr('class', 'overlays');

    // Recompute shared layout values
    const schemeName = (rendererOptions.color_scheme ?? 'lastwave') as keyof typeof schemes;
    const scheme: ColorScheme =
      (schemes as Record<string, ColorScheme>)[schemeName] ?? schemes.lastwave;
    const isDark = document.documentElement.classList.contains('dark');
    const bgColor: string =
      !isDark && scheme.backgroundColorLight ? scheme.backgroundColorLight : scheme.backgroundColor;
    const fontColor: string =
      !isDark && scheme.fontColorLight ? scheme.fontColorLight : scheme.fontColor;
    const axisLabelColor = (() => {
      const hex = bgColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luminance > 0.5 ? '#000000' : '#ffffff';
    })();
    const fontFamily = rendererOptions.font ?? 'DM Sans';
    const height = rendererOptions.height ? parseInt(rendererOptions.height, 10) : DEFAULT_HEIGHT;
    const numSegments = seriesData[0]?.counts.length ?? 0;
    if (numSegments === 0) return;
    const userWidth = rendererOptions.width ? parseInt(rendererOptions.width, 10) : 0;
    const width = userWidth > 0 ? userWidth : numSegments * DEFAULT_WIDTH_PER_PEAK;
    const xScale = d3
      .scaleLinear()
      .domain([0, numSegments - 1])
      .range([0, width]);

    const addMonths = rendererOptions.add_months ?? true;
    const addYears = rendererOptions.add_years ?? isYearRange;
    const showUsername = rendererOptions.show_username ?? false;
    const showWatermark = rendererOptions.show_watermark ?? true;

    // Month labels along the bottom
    if (addMonths && timeStart && timeEnd) {
      const startMs =
        timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart).getTime();
      const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd).getTime();
      const timePerSegment = (endMs - startMs) / numSegments;
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      let lastMonth = -1;

      for (let i = 0; i < numSegments; i++) {
        const segDate = new Date(startMs + i * timePerSegment);
        const month = segDate.getMonth();
        if (month !== lastMonth) {
          lastMonth = month;
          overlayG
            .append('text')
            .attr('x', xScale(i))
            .attr('y', height - 5)
            .attr('font-size', '10px')
            .attr('font-family', fontFamily)
            .attr('fill', axisLabelColor)
            .text(monthNames[month]);
        }
      }
    }

    // Year labels (separator lines are rendered behind waves in the core effect)
    if (addYears && timeStart && timeEnd) {
      const startMs =
        timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart).getTime();
      const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd).getTime();
      const timePerSegment = (endMs - startMs) / numSegments;
      let lastYear = -1;

      for (let i = 0; i < numSegments; i++) {
        const segDate = new Date(startMs + i * timePerSegment);
        const year = segDate.getFullYear();
        if (year !== lastYear) {
          lastYear = year;
          overlayG
            .append('text')
            .attr('x', xScale(i) + (i > 0 ? 4 : 0))
            .attr('y', 15)
            .attr('font-size', '12px')
            .attr('font-family', fontFamily)
            .attr('fill', axisLabelColor)
            .attr('font-weight', 'bold')
            .text(String(year));
        }
      }
    }

    // Watermark
    if (showWatermark) {
      overlayG
        .append('text')
        .attr('x', width - 5)
        .attr('y', height - 5)
        .attr('text-anchor', 'end')
        .attr('font-size', '14px')
        .attr('font-family', fontFamily)
        .attr('fill', fontColor)
        .attr('opacity', 0.5)
        .text('lastwave');
    }

    // Username
    if (username && showUsername) {
      const maxWidth = width / 3;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      let fontSize = Math.round(height / 12);
      ctx.font = `${fontSize}px ${fontFamily}`;
      const measured = ctx.measureText(username).width;
      if (measured > maxWidth) {
        fontSize = Math.floor(fontSize * (maxWidth / measured));
      }
      fontSize = Math.max(10, fontSize);

      const usernameColor: string = scheme.backgroundColorLight
        ? isDark
          ? '#ffffff'
          : '#000000'
        : fontColor;

      overlayG
        .append('text')
        .attr('x', 5)
        .attr('y', fontSize + 2)
        .attr('font-size', `${fontSize}px`)
        .attr('font-family', fontFamily)
        .attr('font-weight', 'bold')
        .attr('fill', usernameColor)
        .attr('opacity', 0.2)
        .text(username);
    }
  }, [seriesData, rendererOptions, username, timeStart, timeEnd, suppressLabels]);

  return (
    <div id="svg-wrapper" className="flex justify-center overflow-x-auto">
      <div className="overflow-hidden rounded-lg">
        <svg ref={svgRef} style={{ display: 'block' }} />
      </div>
    </div>
  );
});
