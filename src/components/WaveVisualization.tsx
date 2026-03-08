import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type SeriesData from '@/core/models/SeriesData';
import { useLastWaveStore } from '@/store/index';
import schemes from '@/core/config/schemes.json';
import { findLabelIndices, createCanvasMeasurer } from '@/core/wave/util';
import { isWType, getWLabel } from '@/core/wave/waveW';
import { isXType, getXLabel } from '@/core/wave/waveX';
import { isYType, getYLabel } from '@/core/wave/waveY';
import { isZType, getZLabel } from '@/core/wave/waveZ';
import { computeDeformedText } from '@/core/wave/deformTextOptB';
import { buildBandLUT, checkLabelOverflow } from '@/core/wave/overflowDetection';
import type { OverflowInfo } from '@/core/wave/overflowDetection';
import Peak from '@/core/models/Peak';
import type { StackPoint } from '@/core/models/Peak';
import FontData from '@/core/models/FontData';
import type Label from '@/core/models/Label';

const DEFAULT_WIDTH_PER_PEAK = 150;
const DEFAULT_HEIGHT = 550;
const MINIMUM_SEGMENTS_BETWEEN_LABELS = 3;
const MINIMUM_FONT_SIZE_PIXELS = 8;

const OFFSET_MAP: Record<string, (series: d3.Series<any, any>, order: number[]) => void> = {
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

// Assign colors to stacked layers.
// Each artist gets a stable color from a hash of its name (survives animation).
// When `fixAdjacency` is true (final render), a post-pass shifts any adjacent
// bands that ended up with the same color.
function assignStackColors(keys: string[], colors: string[], fixAdjacency = false): Map<string, string> {
  const n = colors.length;
  const stride = Math.max(1, Math.round(n * 0.618));
  const map = new Map<string, string>();
  for (const key of keys) {
    map.set(key, colors[Math.abs(hashString(key) * stride) % n]);
  }
  if (fixAdjacency) {
    for (let i = 1; i < keys.length; i++) {
      if (map.get(keys[i]) === map.get(keys[i - 1])) {
        const cur = colors.indexOf(map.get(keys[i])!);
        map.set(keys[i], colors[(cur + 1) % n]);
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
  suppressLabels?: boolean;
}

export default function WaveVisualization({ seriesData, onOverflowsDetected, onRenderComplete, onDrawingProgress, suppressLabels }: WaveVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const deformAbortRef = useRef(0);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const username = useLastWaveStore((s) => s.dataSourceOptions.username);
  const timeStart = useLastWaveStore((s) => s.dataSourceOptions.time_start);
  const timeEnd = useLastWaveStore((s) => s.dataSourceOptions.time_end);

  // Auto-enable year labels when time range >= 1 year
  const isYearRange = (() => {
    if (!timeStart || !timeEnd) return false;
    const startMs = timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart as string).getTime();
    const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd as string).getTime();
    return (endMs - startMs) >= 365 * 24 * 60 * 60 * 1000;
  })();

  useEffect(() => {
    if (!svgRef.current) return;
    const abortId = ++deformAbortRef.current; // cancel any in-flight deformed text render

    const svg = d3.select(svgRef.current);

    const schemeName = (rendererOptions.color_scheme ?? 'lastwave') as keyof typeof schemes;
    const scheme = (schemes as Record<string, any>)[schemeName] ?? schemes.lastwave;
    const colors = scheme.schemeColors;
    const isDark = document.documentElement.classList.contains('dark');

    // Themes with backgroundColorLight adapt to system dark/light mode
    const bgColor = (!isDark && scheme.backgroundColorLight)
      ? scheme.backgroundColorLight
      : scheme.backgroundColor;

    const height = rendererOptions.height ? parseInt(rendererOptions.height, 10) : DEFAULT_HEIGHT;

    // When no data yet, render just the background so the chart area is visible immediately
    if (seriesData.length === 0) {
      svg.selectAll('*').remove();
      const userWidth = rendererOptions.width ? parseInt(rendererOptions.width, 10) : 0;
      const placeholderWidth = userWidth > 0 ? userWidth : 13 * DEFAULT_WIDTH_PER_PEAK;
      svg.attr('width', placeholderWidth).attr('height', height).attr('viewBox', `0 0 ${placeholderWidth} ${height}`);
      svg.append('rect').attr('width', placeholderWidth).attr('height', height).attr('fill', bgColor);
      return;
    }

    const fontColor = (!isDark && scheme.fontColorLight)
      ? scheme.fontColorLight
      : scheme.fontColor;
    const fontFamily = rendererOptions.font ?? 'DM Sans';
    const offsetName = rendererOptions.offset ?? 'silhouette';
    const offsetFn = OFFSET_MAP[offsetName] ?? d3.stackOffsetSilhouette;
    const addLabels = !suppressLabels && (rendererOptions.add_labels ?? true);
    const deformText = rendererOptions.deform_text ?? true;

    // Determine dimensions
    const numSegments = seriesData[0]?.counts.length ?? 0;
    const userWidth = rendererOptions.width ? parseInt(rendererOptions.width, 10) : 0;
    const width = userWidth > 0 ? userWidth : numSegments * DEFAULT_WIDTH_PER_PEAK;

    // Pivot data: from SeriesData[] to tabular format for d3.stack
    const keys = seriesData.map((s) => s.title);
    const colorMap = assignStackColors(keys, colors, !suppressLabels);
    const tableData: Record<string, number>[] = [];
    for (let i = 0; i < numSegments; i++) {
      const row: Record<string, number> = { index: i };
      seriesData.forEach((s) => {
        row[s.title] = s.counts[i] ?? 0;
      });
      tableData.push(row);
    }

    // D3 stack
    const stack = d3.stack<Record<string, number>>()
      .keys(keys)
      .offset(offsetFn)
      .order(d3.stackOrderNone);

    const stackedData = stack(tableData);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, numSegments - 1])
      .range([0, width]);

    const yMin = d3.min(stackedData, (layer) => d3.min(layer, (d) => d[0])) ?? 0;
    const yMax = d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1])) ?? 0;
    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([height, 0]);

    // Area generator
    const area = d3.area<[number, number]>()
      .x((_, i) => xScale(i))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    // During animation (suppressLabels), do a fast render: paths + static text, no artist labels
    if (suppressLabels) {
      svg.selectAll('*').remove();
      svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
      svg.append('rect').attr('width', width).attr('height', height).attr('fill', bgColor);

      const fontColor = (!isDark && scheme.fontColorLight) ? scheme.fontColorLight : scheme.fontColor;
      const fontFamily = rendererOptions.font ?? 'DM Sans';
      const addMonths = rendererOptions.add_months ?? true;
      const addYears = rendererOptions.add_years ?? isYearRange;
      const showWatermark = rendererOptions.show_watermark ?? true;

      // Year separator lines (behind wave paths)
      if (addYears && timeStart && timeEnd) {
        const startMs = timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart).getTime();
        const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd).getTime();
        const timePerSegment = (endMs - startMs) / numSegments;
        let lastYear = -1;
        for (let i = 0; i < numSegments; i++) {
          const segDate = new Date(startMs + i * timePerSegment);
          const year = segDate.getFullYear();
          if (year !== lastYear) {
            if (lastYear !== -1) {
              svg.append('line').attr('x1', xScale(i)).attr('y1', 0).attr('x2', xScale(i)).attr('y2', height)
                .attr('stroke', fontColor).attr('stroke-opacity', 0.12).attr('stroke-width', 2);
            }
            lastYear = year;
          }
        }
      }

      svg.selectAll('path.wave')
        .data(stackedData, (d: any) => d.key)
        .join('path')
        .attr('class', 'wave')
        .attr('d', (d) => area(d as any) ?? '')
        .attr('fill', (d: any) => colorMap.get(d.key) ?? colors[0])
        .attr('stroke', 'none')
        .attr('stroke-width', 0);

      if (addMonths && timeStart && timeEnd) {
        const startMs = timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart).getTime();
        const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd).getTime();
        const timePerSegment = (endMs - startMs) / numSegments;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let lastMonth = -1;
        for (let i = 0; i < numSegments; i++) {
          const segDate = new Date(startMs + i * timePerSegment);
          const month = segDate.getMonth();
          if (month !== lastMonth) {
            lastMonth = month;
            svg.append('text').attr('x', xScale(i)).attr('y', height - 5)
              .attr('font-size', '10px').attr('font-family', fontFamily).attr('fill', fontColor)
              .text(monthNames[month]);
          }
        }
      }

      if (addYears && timeStart && timeEnd) {
        const startMs = timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart).getTime();
        const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd).getTime();
        const timePerSegment = (endMs - startMs) / numSegments;
        let lastYear = -1;
        for (let i = 0; i < numSegments; i++) {
          const segDate = new Date(startMs + i * timePerSegment);
          const year = segDate.getFullYear();
          if (year !== lastYear) {
            lastYear = year;
            svg.append('text').attr('x', xScale(i) + (i > 0 ? 4 : 0)).attr('y', 15)
              .attr('font-size', '12px').attr('font-family', fontFamily).attr('fill', fontColor).attr('font-weight', 'bold')
              .text(String(year));
          }
        }
      }

      if (showWatermark) {
        svg.append('text').attr('x', width - 5).attr('y', height - 5).attr('text-anchor', 'end')
          .attr('font-size', '14px').attr('font-family', fontFamily).attr('fill', fontColor).attr('opacity', 0.5)
          .text('lastwave');
      }

      return;
    }

    // Full rebuild (final render with labels)
    svg.selectAll('*').remove();

    // Set SVG attributes
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', bgColor);

    // Year separator lines (behind wave paths)
    if ((rendererOptions.add_years ?? isYearRange) && timeStart && timeEnd) {
      const startMs = timeStart instanceof Date ? timeStart.getTime() : new Date(timeStart as string).getTime();
      const endMs = timeEnd instanceof Date ? timeEnd.getTime() : new Date(timeEnd as string).getTime();
      const timePerSegment = (endMs - startMs) / numSegments;
      let lastYear = -1;
      for (let i = 0; i < numSegments; i++) {
        const segDate = new Date(startMs + i * timePerSegment);
        const year = segDate.getFullYear();
        if (year !== lastYear) {
          if (lastYear !== -1) {
            svg.append('line')
              .attr('x1', xScale(i)).attr('y1', 0)
              .attr('x2', xScale(i)).attr('y2', height)
              .attr('stroke', fontColor).attr('stroke-opacity', 0.12).attr('stroke-width', 2);
          }
          lastYear = year;
        }
      }
    }

    // Embed font in SVG so text renders when downloaded/viewed standalone
    const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, '+')}&display=swap`;
    const defs = svg.append('defs');
    defs.append('style')
      .text(`@import url('${fontUrl}');`);

    // Draw paths — capture path strings for overflow detection
    const pathStrings: string[] = [];
    svg.selectAll('path.wave')
      .data(stackedData, (d: any) => d.key)
      .join('path')
      .attr('class', 'wave')
      .attr('d', (d) => {
        const pathD = area(d as any) ?? '';
        pathStrings.push(pathD);
        return pathD;
      })
      .attr('fill', (d: any) => colorMap.get(d.key) ?? colors[0])
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
        };
        const jobs: DeformJob[] = [];

        stackedData.forEach((layer, layerIndex) => {
          const seriesTitle = keys[layerIndex];
          const counts = seriesData[layerIndex].counts;
          const stackPoints: StackPoint[] = layer.map((d, i) => ({
            x: xScale(i),
            y: (height - yScale(d[1])) - (height - yScale(d[0])),
            y0: height - yScale(d[0]),
          }));

          const labelIndices = findLabelIndices(counts, MINIMUM_SEGMENTS_BETWEEN_LABELS);
          labelIndices.forEach((idx) => {
            if (idx <= 0 || idx >= stackPoints.length - 1) return;
            const peak = new Peak(idx, stackPoints);
            let label: Label | null = null;
            if (isWType(peak)) {
              label = getWLabel(peak, seriesTitle, fontData.family, measureText, stackPoints, idx);
            } else if (isZType(peak)) {
              label = getZLabel(peak, seriesTitle, fontData.family, measureText, stackPoints, idx);
            } else if (isYType(peak)) {
              label = getYLabel(peak, seriesTitle, fontData.family, measureText, stackPoints, idx);
            } else if (isXType(peak)) {
              label = getXLabel(peak, seriesTitle, fontData.family, measureText, stackPoints, idx);
            }
            if (label && label.fontSize >= MINIMUM_FONT_SIZE_PIXELS) {
              jobs.push({ label, layer: layer as any, layerIndex, stackPoints, idx });
            }
          });
        });

        // Process deform jobs in batches, yielding between batches
        const BATCH_SIZE = 8;
        let jobIndex = 0;
        // Track unique artists for progress display
        const uniqueArtists = [...new Set(jobs.map(j => j.label.text))];
        const artistsDone = new Set<string>();

        function processBatch() {
          if (abortId !== deformAbortRef.current) return; // effect re-ran, abort
          const end = Math.min(jobIndex + BATCH_SIZE, jobs.length);

          for (; jobIndex < end; jobIndex++) {
            const { label, layer, layerIndex, stackPoints, idx } = jobs[jobIndex];
            artistsDone.add(label.text);

            const bandData = layer.map((d: readonly [number, number], i: number) => ({
              x: xScale(i),
              topY: yScale(d[1]),
              botY: yScale(d[0]),
              centerY: (yScale(d[0]) + yScale(d[1])) / 2,
              thickness: yScale(d[0]) - yScale(d[1]),
            }));

            const result = computeDeformedText(
              label, bandData, idx, stackPoints[idx].x,
              fontData.family, measureText,
            );

            for (const p of result.placements) {
              if (p.fontSize < 4) continue;
              const tx = `translate(${p.x}, ${p.y}) rotate(${p.angle}) scale(1, ${p.scaleY.toFixed(3)})`;
              svg.append('text')
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
            y: (height - yScale(d[1])) - (height - yScale(d[0])),
            y0: height - yScale(d[0]),
          }));

          const labelIndices = findLabelIndices(counts, MINIMUM_SEGMENTS_BETWEEN_LABELS);
          labelIndices.forEach((idx) => {
            if (idx <= 0 || idx >= stackPoints.length - 1) return;
            const peak = new Peak(idx, stackPoints);
            let label: Label | null = null;
            if (isWType(peak)) {
              label = getWLabel(peak, seriesTitle, fontData.family, measureText, stackPoints, idx);
            } else if (isZType(peak)) {
              label = getZLabel(peak, seriesTitle, fontData.family, measureText, stackPoints, idx);
            } else if (isYType(peak)) {
              label = getYLabel(peak, seriesTitle, fontData.family, measureText, stackPoints, idx);
            } else if (isXType(peak)) {
              label = getXLabel(peak, seriesTitle, fontData.family, measureText, stackPoints, idx);
            }

            if (label && label.fontSize >= MINIMUM_FONT_SIZE_PIXELS) {
              const textEl = svg.append('text')
                .attr('x', label.xPosition)
                .attr('y', height - label.yPosition)
                .attr('font-size', `${label.fontSize}px`)
                .attr('font-family', fontData.family)
                .attr('fill', fontData.color)
                .text(label.text);

              const pathD = pathStrings[layerIndex];
              if (pathD && isFinite(label.xPosition) && isFinite(label.yPosition)) {
                const bandLUT = buildBandLUT(pathD, width);
                if (bandLUT) {
                  const overflow = checkLabelOverflow(label, fontData.family, height, bandLUT);
                  if (overflow && overflow.overflowPct >= 5) {
                    detectedOverflows.push(overflow);
                    textEl.attr('data-overflow', 'true');
                  }
                }
              }
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

  }, [seriesData, rendererOptions.color_scheme, rendererOptions.font, rendererOptions.offset,
      rendererOptions.width, rendererOptions.height, rendererOptions.add_labels,
      rendererOptions.deform_text, suppressLabels]);

  // ── Overlay effect: cheap decorations that can toggle without re-rendering waves+labels ──
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Remove only the overlay group (not the entire SVG)
    svg.selectAll('.overlays').remove();
    const overlayG = svg.append('g').attr('class', 'overlays');

    // Recompute shared layout values
    const schemeName = (rendererOptions.color_scheme ?? 'lastwave') as keyof typeof schemes;
    const scheme = (schemes as Record<string, any>)[schemeName] ?? schemes.lastwave;
    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = (!isDark && scheme.backgroundColorLight)
      ? scheme.backgroundColorLight
      : scheme.backgroundColor;
    const fontColor = (!isDark && scheme.fontColorLight)
      ? scheme.fontColorLight
      : scheme.fontColor;
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
    const xScale = d3.scaleLinear().domain([0, numSegments - 1]).range([0, width]);

    const addMonths = rendererOptions.add_months ?? true;
    const addYears = rendererOptions.add_years ?? isYearRange;
    const showUsername = rendererOptions.show_username ?? false;
    const showWatermark = rendererOptions.show_watermark ?? true;

    // Month labels along the bottom
    if (addMonths && timeStart && timeEnd) {
      const startMs = timeStart instanceof Date
        ? timeStart.getTime()
        : new Date(timeStart).getTime();
      const endMs = timeEnd instanceof Date
        ? timeEnd.getTime()
        : new Date(timeEnd).getTime();
      const timePerSegment = (endMs - startMs) / numSegments;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let lastMonth = -1;

      for (let i = 0; i < numSegments; i++) {
        const segDate = new Date(startMs + i * timePerSegment);
        const month = segDate.getMonth();
        if (month !== lastMonth) {
          lastMonth = month;
          overlayG.append('text')
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
      const startMs = timeStart instanceof Date
        ? timeStart.getTime()
        : new Date(timeStart).getTime();
      const endMs = timeEnd instanceof Date
        ? timeEnd.getTime()
        : new Date(timeEnd).getTime();
      const timePerSegment = (endMs - startMs) / numSegments;
      let lastYear = -1;

      for (let i = 0; i < numSegments; i++) {
        const segDate = new Date(startMs + i * timePerSegment);
        const year = segDate.getFullYear();
        if (year !== lastYear) {
          lastYear = year;
          overlayG.append('text')
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
      overlayG.append('text')
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

      const usernameColor = scheme.backgroundColorLight
        ? (isDark ? '#ffffff' : '#000000')
        : fontColor;

      overlayG.append('text')
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
    <div id="svg-wrapper" className="overflow-x-auto flex justify-center">
      <svg ref={svgRef} style={{ display: 'block' }} />
    </div>
  );
}
