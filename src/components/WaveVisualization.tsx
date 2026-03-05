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
const DEFAULT_HEIGHT = 600;
const MINIMUM_SEGMENTS_BETWEEN_LABELS = 3;
const MINIMUM_FONT_SIZE_PIXELS = 8;

const OFFSET_MAP: Record<string, (series: d3.Series<any, any>, order: number[]) => void> = {
  silhouette: d3.stackOffsetSilhouette,
  wiggle: d3.stackOffsetWiggle,
  expand: d3.stackOffsetExpand,
  zero: d3.stackOffsetNone,
};

interface WaveVisualizationProps {
  seriesData: SeriesData[];
  onOverflowsDetected?: (overflows: OverflowInfo[]) => void;
}

export default function WaveVisualization({ seriesData, onOverflowsDetected }: WaveVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const dataSourceOptions = useLastWaveStore((s) => s.dataSourceOptions);

  useEffect(() => {
    if (!svgRef.current || seriesData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const schemeName = (rendererOptions.color_scheme ?? 'lastwave') as keyof typeof schemes;
    const scheme = (schemes as Record<string, any>)[schemeName] ?? schemes.lastwave;
    const colors = scheme.schemeColors;
    const isDark = document.documentElement.classList.contains('dark');

    // Themes with backgroundColorLight adapt to system dark/light mode
    const bgColor = (!isDark && scheme.backgroundColorLight)
      ? scheme.backgroundColorLight
      : scheme.backgroundColor;
    const fontColor = (!isDark && scheme.fontColorLight)
      ? scheme.fontColorLight
      : scheme.fontColor;
    const fontFamily = rendererOptions.font ?? 'DM Sans';
    const offsetName = rendererOptions.offset ?? 'silhouette';
    const offsetFn = OFFSET_MAP[offsetName] ?? d3.stackOffsetSilhouette;
    const addLabels = rendererOptions.add_labels ?? true;
    const addMonths = rendererOptions.add_months ?? true;
    const addYears = rendererOptions.add_years ?? false;
    const showUsername = rendererOptions.show_username ?? false;
    const showWatermark = rendererOptions.show_watermark ?? true;

    // Determine dimensions
    const numSegments = seriesData[0]?.counts.length ?? 0;
    const userWidth = rendererOptions.width ? parseInt(rendererOptions.width, 10) : 0;
    const width = userWidth > 0 ? userWidth : numSegments * DEFAULT_WIDTH_PER_PEAK;
    const height = rendererOptions.height ? parseInt(rendererOptions.height, 10) : DEFAULT_HEIGHT;

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
      .data(stackedData)
      .join('path')
      .attr('class', 'wave')
      .attr('d', (d) => {
        const pathD = area(d as any) ?? '';
        pathStrings.push(pathD);
        return pathD;
      })
      .attr('fill', (_, i) => colors[i % colors.length])
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

        // Determine label indices
        const labelIndices = findLabelIndices(counts, MINIMUM_SEGMENTS_BETWEEN_LABELS);

        labelIndices.forEach((idx) => {
          if (idx <= 0 || idx >= stackPoints.length - 1) return;

          const peak = new Peak(idx, stackPoints);
          let label: Label | null = null;

          if (isWType(peak)) {
            label = getWLabel(peak, seriesTitle, fontData.family, measureText);
          } else if (isZType(peak)) {
            label = getZLabel(peak, seriesTitle, fontData.family, measureText);
          } else if (isYType(peak)) {
            label = getYLabel(peak, seriesTitle, fontData.family, measureText);
          } else if (isXType(peak)) {
            label = getXLabel(peak, seriesTitle, fontData.family, measureText);
          }

          if (label && label.fontSize >= MINIMUM_FONT_SIZE_PIXELS) {
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
        });
      });
    }

    onOverflowsDetected?.(detectedOverflows);

    // Month labels along the bottom
    if (addMonths && dataSourceOptions.time_start && dataSourceOptions.time_end) {
      const startTime = dataSourceOptions.time_start instanceof Date
        ? dataSourceOptions.time_start.getTime()
        : new Date(dataSourceOptions.time_start).getTime();
      const endTime = dataSourceOptions.time_end instanceof Date
        ? dataSourceOptions.time_end.getTime()
        : new Date(dataSourceOptions.time_end).getTime();
      const timePerSegment = (endTime - startTime) / numSegments;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let lastMonth = -1;

      for (let i = 0; i < numSegments; i++) {
        const segDate = new Date(startTime + i * timePerSegment);
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
    if (addYears && dataSourceOptions.time_start && dataSourceOptions.time_end) {
      const startTime = dataSourceOptions.time_start instanceof Date
        ? dataSourceOptions.time_start.getTime()
        : new Date(dataSourceOptions.time_start).getTime();
      const endTime = dataSourceOptions.time_end instanceof Date
        ? dataSourceOptions.time_end.getTime()
        : new Date(dataSourceOptions.time_end).getTime();
      const timePerSegment = (endTime - startTime) / numSegments;
      let lastYear = -1;

      for (let i = 0; i < numSegments; i++) {
        const segDate = new Date(startTime + i * timePerSegment);
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
    const username = dataSourceOptions.username;
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
  }, [seriesData, rendererOptions, dataSourceOptions]);

  return (
    <div id="svg-wrapper" className="overflow-x-auto flex justify-center">
      <svg ref={svgRef} style={{ display: 'block' }} />
    </div>
  );
}
