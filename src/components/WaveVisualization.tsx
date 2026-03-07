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

// Assign colors to stacked layers so that adjacent bands never share a color.
// Uses a stride roughly equal to the golden ratio of the palette size to
// maximise visual separation between neighbouring bands.
function assignStackColors(keys: string[], colors: string[]): Map<string, string> {
  const n = colors.length;
  const stride = Math.max(1, Math.round(n * 0.618));
  const map = new Map<string, string>();
  let ci = 0;
  for (const key of keys) {
    map.set(key, colors[ci % n]);
    ci += stride;
  }
  return map;
}

interface WaveVisualizationProps {
  seriesData: SeriesData[];
  onOverflowsDetected?: (overflows: OverflowInfo[]) => void;
  onRenderComplete?: () => void;
  suppressLabels?: boolean;
}

export default function WaveVisualization({ seriesData, onOverflowsDetected, onRenderComplete, suppressLabels }: WaveVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const deformAbortRef = useRef(0);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const username = useLastWaveStore((s) => s.dataSourceOptions.username);
  const timeStart = useLastWaveStore((s) => s.dataSourceOptions.time_start);
  const timeEnd = useLastWaveStore((s) => s.dataSourceOptions.time_end);

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
    const colorMap = assignStackColors(keys, colors);
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
      svg.selectAll('path.wave')
        .data(stackedData, (d: any) => d.key)
        .join('path')
        .attr('class', 'wave')
        .attr('d', (d) => area(d as any) ?? '')
        .attr('fill', (d: any) => colorMap.get(d.key) ?? colors[0])
        .attr('stroke', 'none')
        .attr('stroke-width', 0);

      const fontColor = (!isDark && scheme.fontColorLight) ? scheme.fontColorLight : scheme.fontColor;
      const fontFamily = rendererOptions.font ?? 'DM Sans';
      const addMonths = rendererOptions.add_months ?? true;
      const addYears = rendererOptions.add_years ?? false;
      const showWatermark = rendererOptions.show_watermark ?? true;

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
            svg.append('text').attr('x', xScale(i)).attr('y', 15)
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

        function processBatch() {
          if (abortId !== deformAbortRef.current) return; // effect re-ran, abort
          const end = Math.min(jobIndex + BATCH_SIZE, jobs.length);

          for (; jobIndex < end; jobIndex++) {
            const { label, layer, layerIndex, stackPoints, idx } = jobs[jobIndex];

            const bandData = layer.map((d: readonly [number, number], i: number) => ({
              x: xScale(i),
              topY: yScale(d[1]),
              botY: yScale(d[0]),
              centerY: (yScale(d[0]) + yScale(d[1])) / 2,
              thickness: yScale(d[0]) - yScale(d[1]),
            }));
            const centerLineFn = d3.line<{ x: number; centerY: number }>()
              .x((d) => d.x).y((d) => d.centerY).curve(d3.curveMonotoneX);
            const clPathD = centerLineFn(bandData);
            if (!clPathD) continue;
            const clPathEl = defs.append('path').attr('id', `cl-tmp-${jobIndex}`).attr('d', clPathD);
            const clNode = clPathEl.node() as SVGPathElement;
            const totalLen = clNode.getTotalLength();
            const bandXStep = bandData.length > 1 ? bandData[1].x - bandData[0].x : 1;
            const bandX0 = bandData[0].x;

            function bandAtX(x: number) {
              const fi = (x - bandX0) / bandXStep;
              const i = Math.max(0, Math.min(bandData.length - 2, Math.floor(fi)));
              const t = Math.max(0, Math.min(1, fi - i));
              return {
                thickness: bandData[i].thickness * (1 - t) + bandData[i + 1].thickness * t,
                topY: bandData[i].topY * (1 - t) + bandData[i + 1].topY * t,
                botY: bandData[i].botY * (1 - t) + bandData[i + 1].botY * t,
                centerY: bandData[i].centerY * (1 - t) + bandData[i + 1].centerY * t,
              };
            }
            function lengthAtX(targetX: number) {
              let lo = 0, hi = totalLen;
              for (let i = 0; i < 20; i++) {
                const mid = (lo + hi) / 2;
                if (clNode.getPointAtLength(mid).x < targetX) lo = mid; else hi = mid;
              }
              return (lo + hi) / 2;
            }

            const text = label.text;
            const baseFontSize = label.fontSize;
            const peakThickness = bandData[idx]?.thickness ?? 1;
            const renderFontSize = baseFontSize * 1.15;
            const peakX = stackPoints[idx].x;
            const lastBandX = bandData[bandData.length - 1].x;
            const firstBandX = bandData[0].x;

            const approxCharWidth = renderFontSize * 0.55;
            const approxTotalWidth = text.length * approxCharWidth;

            const searchRadius = approxTotalWidth * 0.8;
            let weightedXSum = 0, weightSum = 0;
            for (const bd of bandData) {
              if (Math.abs(bd.x - peakX) > searchRadius) continue;
              const thickFrac = bd.thickness / (peakThickness || 1);
              if (thickFrac >= 0.35) {
                const w = thickFrac * thickFrac;
                weightedXSum += bd.x * w;
                weightSum += w;
              }
            }
            const thickCenterX = weightSum > 0 ? weightedXSum / weightSum : peakX;

            const tentativeStart = thickCenterX - approxTotalWidth / 2;
            let deformedTotalWidth = 0;
            {
              let walkX = Math.max(firstBandX, tentativeStart);
              for (let c = 0; c < text.length; c++) {
                const band = bandAtX(walkX);
                const thickRatio = peakThickness > 0 ? band.thickness / peakThickness : 1;
                const charFontSize = Math.max(3, renderFontSize * Math.pow(Math.min(thickRatio, 1.8), 0.85));
                const charW = measureText(text[c], fontData.family, charFontSize).width;
                deformedTotalWidth += charW + charFontSize * 0.04;
                walkX += charW + charFontSize * 0.04;
              }
            }

            const idealStart = thickCenterX - deformedTotalWidth / 2;
            const textStartX = Math.max(firstBandX, Math.min(lastBandX - deformedTotalWidth * 0.05, idealStart));
            const startLen = lengthAtX(textStartX);
            const MAX_ANGLE = 30;
            const BAND_MARGIN = 0.92;

            const charData: Array<{
              ch: string; fontSize: number; scaleY: number;
              opacity: number; width: number; fontWeight: number;
            }> = [];
            let estLen = startLen;
            for (let c = 0; c < text.length; c++) {
              const pt = clNode.getPointAtLength(Math.min(estLen, totalLen));
              const band = bandAtX(pt.x);
              const localThick = band.thickness;
              const thickRatio = peakThickness > 0 ? localThick / peakThickness : 1;

              let fontSize = Math.max(3, renderFontSize * Math.pow(Math.min(thickRatio, 1.8), 0.85));
              const naturalH = fontSize * 1.2;
              let scaleY = naturalH > 0 ? Math.min(1.8, Math.max(0.5, (localThick * 0.85) / naturalH)) : 1;
              const fontWeight = 400;

              const availHalfH = (localThick * BAND_MARGIN) / 2;
              if (availHalfH > 0 && localThick > 0) {
                const bPrev = bandAtX(Math.max(firstBandX, pt.x - 3));
                const bNext = bandAtX(Math.min(lastBandX, pt.x + 3));
                const rawAngle = Math.atan2(bNext.centerY - bPrev.centerY, 6) * (180 / Math.PI);
                const clampedAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, rawAngle));
                const rad = Math.abs(clampedAngle * Math.PI / 180);
                const cosA = Math.cos(rad); const sinA = Math.sin(rad);
                const halfW = fontSize * 0.3;
                const halfH = (fontSize * scaleY) / 2;
                const bboxH = halfW * sinA + halfH * cosA;
                if (bboxH > availHalfH) {
                  const s = availHalfH / bboxH;
                  fontSize *= s; scaleY *= s;
                }
              }

              const opacity = Math.min(1, Math.max(0.15, localThick / (renderFontSize * 0.6)));
              const charW = measureText(text[c], fontData.family, fontSize).width;
              charData.push({ ch: text[c], fontSize, scaleY, opacity, width: charW, fontWeight });
              estLen += charW + fontSize * 0.04;
            }

            let curLen = startLen;
            for (let c = 0; c < text.length; c++) {
              const { ch, fontSize, scaleY, opacity, width: charW, fontWeight } = charData[c];
              if (fontSize < 4) { curLen += charW + fontSize * 0.04; continue; }

              const midLen = Math.min(curLen + charW / 2, totalLen);
              const midPt = clNode.getPointAtLength(midLen);
              const dt = 1.5;
              const p1 = clNode.getPointAtLength(Math.max(0, midLen - dt));
              const p2 = clNode.getPointAtLength(Math.min(totalLen, midLen + dt));
              const rawAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
              const angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, rawAngle));

              const tx = `translate(${midPt.x}, ${midPt.y}) rotate(${angle}) scale(1, ${scaleY.toFixed(3)})`;
              svg.append('text')
                .attr('font-size', `${fontSize}px`)
                .attr('font-family', fontData.family)
                .attr('font-weight', fontWeight)
                .attr('fill', fontData.color)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('transform', tx)
                .attr('opacity', opacity)
                .text(ch);

              curLen += charW + fontSize * 0.04;
            }

            clPathEl.remove();
          }

          if (jobIndex < jobs.length) {
            requestAnimationFrame(processBatch);
          } else {
            onRenderComplete?.();
          }
        }

        if (jobs.length > 0) {
          // Defer first batch so React can paint the "Drawing…" indicator
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
    const addYears = rendererOptions.add_years ?? false;
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

    // Year labels
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
            .attr('x', xScale(i))
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
