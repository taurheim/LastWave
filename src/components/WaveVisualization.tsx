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

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function colorForKey(key: string, colors: string[]): string {
  return colors[hashString(key) % colors.length];
}

interface WaveVisualizationProps {
  seriesData: SeriesData[];
  onOverflowsDetected?: (overflows: OverflowInfo[]) => void;
  suppressLabels?: boolean;
}

export default function WaveVisualization({ seriesData, onOverflowsDetected, suppressLabels }: WaveVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const username = useLastWaveStore((s) => s.dataSourceOptions.username);
  const timeStart = useLastWaveStore((s) => s.dataSourceOptions.time_start);
  const timeEnd = useLastWaveStore((s) => s.dataSourceOptions.time_end);

  useEffect(() => {
    if (!svgRef.current) return;

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
    const addMonths = rendererOptions.add_months ?? true;
    const addYears = rendererOptions.add_years ?? false;
    const showUsername = rendererOptions.show_username ?? false;
    const showWatermark = rendererOptions.show_watermark ?? true;
    const deformText = rendererOptions.deform_text ?? false;

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
        .attr('fill', (d: any) => colorForKey(d.key, colors))
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
      .attr('fill', (d: any) => colorForKey(d.key, colors))
      .attr('stroke', 'none')
      .attr('stroke-width', 0);

    // Add text labels using wave algorithms
    const detectedOverflows: OverflowInfo[] = [];
    if (addLabels) {
      const measureText = createCanvasMeasurer();
      const fontData = new FontData(fontFamily, fontColor);

      stackedData.forEach((layer, layerIndex) => {
        const seriesTitle = keys[layerIndex];
        const counts = seriesData[layerIndex].counts;

        // Build StackPoint array in inverted coordinate space (y=0 at bottom)
        // to match the coordinate system the wave algorithms expect
        const stackPoints: StackPoint[] = layer.map((d, i) => ({
          x: xScale(i),
          y: (height - yScale(d[1])) - (height - yScale(d[0])),
          y0: height - yScale(d[0]),
        }));

        // Band geometry + centerline (needed for deformed text, computed lazily)
        let bandData: Array<{ x: number; topY: number; botY: number; centerY: number; thickness: number }> | null = null;
        let clNode: SVGPathElement | null = null;
        let totalLen = 0;
        let bandXStep = 1;
        let bandX0 = 0;

        if (deformText) {
          bandData = layer.map((d, i) => ({
            x: xScale(i),
            topY: yScale(d[1]),
            botY: yScale(d[0]),
            centerY: (yScale(d[0]) + yScale(d[1])) / 2,
            thickness: yScale(d[0]) - yScale(d[1]),
          }));
          const centerLineFn = d3.line<{ x: number; centerY: number }>()
            .x((d) => d.x)
            .y((d) => d.centerY)
            .curve(d3.curveMonotoneX);
          const clPathD = centerLineFn(bandData);
          if (!clPathD) return;
          const clPathEl = defs
            .append('path')
            .attr('id', `cl-${layerIndex}`)
            .attr('d', clPathD);
          clNode = clPathEl.node() as SVGPathElement;
          totalLen = clNode.getTotalLength();
          bandXStep = bandData.length > 1 ? bandData[1].x - bandData[0].x : 1;
          bandX0 = bandData[0].x;
        }

        function bandAtX(x: number): { thickness: number; topY: number; botY: number; centerY: number } {
          const bd = bandData!;
          const fi = (x - bandX0) / bandXStep;
          const i = Math.max(0, Math.min(bd.length - 2, Math.floor(fi)));
          const t = Math.max(0, Math.min(1, fi - i));
          return {
            thickness: bd[i].thickness * (1 - t) + bd[i + 1].thickness * t,
            topY: bd[i].topY * (1 - t) + bd[i + 1].topY * t,
            botY: bd[i].botY * (1 - t) + bd[i + 1].botY * t,
            centerY: bd[i].centerY * (1 - t) + bd[i + 1].centerY * t,
          };
        }

        function lengthAtX(targetX: number): number {
          let lo = 0, hi = totalLen;
          for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            if (clNode!.getPointAtLength(mid).x < targetX) lo = mid;
            else hi = mid;
          }
          return (lo + hi) / 2;
        }

        // Determine label indices
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
            if (deformText && bandData && clNode) {
              // ── Deformed text: per-character placement along the centerline ──
              const text = label.text;
              const baseFontSize = label.fontSize;
              const peakThickness = bandData[idx]?.thickness ?? 1;
              const renderFontSize = baseFontSize * 1.15;
              const peakX = stackPoints[idx].x;
              const lastBandX = bandData[bandData.length - 1].x;
              const firstBandX = bandData[0].x;

              const approxCharWidth = renderFontSize * 0.55;
              const approxTotalWidth = text.length * approxCharWidth;

              // Thickness-weighted centroid for centering
              const searchRadius = approxTotalWidth * 0.8;
              let weightedXSum = 0;
              let weightSum = 0;
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

              // Deformation-aware width estimation
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

              // Pass 1: pre-compute per-character geometry with bounds checking
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
                  const cosA = Math.cos(rad);
                  const sinA = Math.sin(rad);
                  const halfW = fontSize * 0.3;
                  const halfH = (fontSize * scaleY) / 2;
                  const bboxH = halfW * sinA + halfH * cosA;
                  if (bboxH > availHalfH) {
                    const s = availHalfH / bboxH;
                    fontSize *= s;
                    scaleY *= s;
                  }
                }

                const opacity = Math.min(1, Math.max(0.15, localThick / (renderFontSize * 0.6)));
                const charW = measureText(text[c], fontData.family, fontSize).width;
                charData.push({ ch: text[c], fontSize, scaleY, opacity, width: charW, fontWeight });
                estLen += charW + fontSize * 0.04;
              }

              // Pass 2: render each character with rotation + vertical stretch
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
            } else {
              // ── Normal horizontal text rendering ──
              const textEl = svg.append('text')
                .attr('x', label.xPosition)
                .attr('y', height - label.yPosition)
                .attr('font-size', `${label.fontSize}px`)
                .attr('font-family', fontData.family)
                .attr('fill', fontData.color)
                .text(label.text);

              // Check for Bezier overflow
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
          }
        });
      });
    }

    onOverflowsDetected?.(detectedOverflows);

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
          svg.append('text')
            .attr('x', xScale(i))
            .attr('y', height - 5)
            .attr('font-size', '10px')
            .attr('font-family', fontFamily)
            .attr('fill', fontColor)
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
          svg.append('text')
            .attr('x', xScale(i))
            .attr('y', 15)
            .attr('font-size', '12px')
            .attr('font-family', fontFamily)
            .attr('fill', fontColor)
            .attr('font-weight', 'bold')
            .text(String(year));
        }
      }
    }

    // Watermark
    if (showWatermark) {
      svg.append('text')
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
      // Scale font size so the username fits within 1/3 of the graph width
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

      svg.append('text')
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
