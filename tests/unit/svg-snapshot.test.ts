import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import type SeriesData from '@/core/models/SeriesData';
import { findLabelIndices } from '@/core/wave/util';
import type { MeasureTextFn } from '@/core/wave/util';
import { isWType, getWLabel } from '@/core/wave/waveW';
import { isXType, getXLabel } from '@/core/wave/waveX';
import { isYType, getYLabel } from '@/core/wave/waveY';
import { isZType, getZLabel } from '@/core/wave/waveZ';
import Peak from '@/core/models/Peak';
import type { StackPoint } from '@/core/models/Peak';
import schemes from '@/core/config/schemes.json';
import type Label from '@/core/models/Label';
import { simpleSeriesData, largeSeriesData, singleArtistData, spikeData } from '../fixtures/series-data';

// Deterministic text measurer (no canvas needed in test)
const mockMeasureText: MeasureTextFn = (_text, _font, fontSize) => {
  const charWidth = fontSize * 0.6;
  const width = _text.length * charWidth;
  const height = fontSize * 1.2;
  return { height, width, slope: height / width };
};

const OFFSET_MAP: Record<string, (series: d3.Series<any, any>, order: number[]) => void> = {
  silhouette: d3.stackOffsetSilhouette,
  wiggle: d3.stackOffsetWiggle,
  expand: d3.stackOffsetExpand,
  zero: d3.stackOffsetNone,
};

/**
 * Renders a wave SVG using D3 (mirrors WaveVisualization.tsx logic)
 * but as a pure function on a jsdom SVG element.
 */
function renderWaveSvg(
  seriesData: SeriesData[],
  options: {
    width?: number;
    height?: number;
    offset?: string;
    schemeName?: string;
    addLabels?: boolean;
    stroke?: boolean;
  } = {}
): string {
  const {
    width: userWidth,
    height = 600,
    offset = 'silhouette',
    schemeName = 'lastwave',
    addLabels = true,
    stroke = true,
  } = options;

  const numSegments = seriesData[0]?.counts.length ?? 0;
  const width = userWidth ?? numSegments * 150;

  const scheme = (schemes as any)[schemeName] ?? (schemes as any).lastwave;
  const colors: string[] = scheme.schemeColors;
  const bgColor: string = scheme.backgroundColor;
  const fontColor: string = scheme.fontColor;

  // Create SVG element in jsdom
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svgEl);
  const svg = d3.select(svgEl);

  // Pivot data
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
  const offsetFn = OFFSET_MAP[offset] ?? d3.stackOffsetSilhouette;
  const stack = d3.stack<Record<string, number>>()
    .keys(keys)
    .offset(offsetFn)
    .order(d3.stackOrderNone);

  const stackedData = stack(tableData);

  // Scales
  const xScale = d3.scaleLinear().domain([0, numSegments - 1]).range([0, width]);
  const yMin = d3.min(stackedData, (layer) => d3.min(layer, (d) => d[0])) ?? 0;
  const yMax = d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1])) ?? 0;
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

  // Area generator
  const area = d3.area<[number, number]>()
    .x((_, i) => xScale(i))
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  // SVG attributes
  svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

  // Background
  svg.append('rect').attr('width', width).attr('height', height).attr('fill', bgColor);

  // Paths
  svg.selectAll('path.wave')
    .data(stackedData)
    .join('path')
    .attr('class', 'wave')
    .attr('d', (d) => area(d as any))
    .attr('fill', (_, i) => colors[i % colors.length])
    .attr('stroke', stroke ? bgColor : 'none')
    .attr('stroke-width', stroke ? 0.5 : 0);

  // Labels
  if (addLabels) {
    stackedData.forEach((layer, layerIndex) => {
      const seriesTitle = keys[layerIndex];
      const counts = seriesData[layerIndex].counts;

      const stackPoints: StackPoint[] = layer.map((d, i) => ({
        x: xScale(i),
        y: (height - yScale(d[1])) - (height - yScale(d[0])),
        y0: height - yScale(d[0]),
      }));

      const labelIndices = findLabelIndices(counts, 3);

      labelIndices.forEach((idx) => {
        if (idx <= 0 || idx >= stackPoints.length - 1) return;

        const peak = new Peak(idx, stackPoints);
        let label: Label | null = null;

        if (isWType(peak)) label = getWLabel(peak, seriesTitle, 'Roboto', mockMeasureText);
        else if (isZType(peak)) label = getZLabel(peak, seriesTitle, 'Roboto', mockMeasureText);
        else if (isYType(peak)) label = getYLabel(peak, seriesTitle, 'Roboto', mockMeasureText);
        else if (isXType(peak)) label = getXLabel(peak, seriesTitle, 'Roboto', mockMeasureText);

        if (label && label.fontSize >= 8) {
          svg.append('text')
            .attr('x', label.xPosition)
            .attr('y', height - label.yPosition)
            .attr('font-size', `${label.fontSize}px`)
            .attr('font-family', 'Roboto')
            .attr('fill', fontColor)
            .text(label.text);
        }
      });
    });
  }

  // Watermark
  svg.append('text')
    .attr('x', width - 5)
    .attr('y', height - 5)
    .attr('text-anchor', 'end')
    .attr('font-size', '9px')
    .attr('fill', fontColor)
    .attr('opacity', '0.5')
    .text('lastwave');

  const result = svgEl.outerHTML;
  document.body.removeChild(svgEl);
  return result;
}

describe('SVG Snapshot Regression', () => {
  it('matches snapshot for simple 3-artist dataset', () => {
    const svg = renderWaveSvg(simpleSeriesData);
    expect(svg).toMatchSnapshot();
  });

  it('matches snapshot for large 8-artist dataset', () => {
    const svg = renderWaveSvg(largeSeriesData);
    expect(svg).toMatchSnapshot();
  });

  it('matches snapshot for single artist', () => {
    const svg = renderWaveSvg(singleArtistData);
    expect(svg).toMatchSnapshot();
  });

  it('matches snapshot for spike data', () => {
    const svg = renderWaveSvg(spikeData);
    expect(svg).toMatchSnapshot();
  });

  it('matches snapshot with ocean color scheme', () => {
    const svg = renderWaveSvg(simpleSeriesData, { schemeName: 'ocean' });
    expect(svg).toMatchSnapshot();
  });

  it('matches snapshot with wiggle offset', () => {
    const svg = renderWaveSvg(simpleSeriesData, { offset: 'wiggle' });
    expect(svg).toMatchSnapshot();
  });

  it('matches snapshot with expand offset', () => {
    const svg = renderWaveSvg(simpleSeriesData, { offset: 'expand' });
    expect(svg).toMatchSnapshot();
  });

  it('matches snapshot without labels', () => {
    const svg = renderWaveSvg(simpleSeriesData, { addLabels: false });
    expect(svg).toMatchSnapshot();
  });

  it('matches snapshot without stroke', () => {
    const svg = renderWaveSvg(simpleSeriesData, { stroke: false });
    expect(svg).toMatchSnapshot();
  });

  it('produces valid SVG structure', () => {
    const svg = renderWaveSvg(simpleSeriesData);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
    expect(svg).toContain('<path');
    expect(svg).toContain('class="wave"');
    expect(svg).toContain('lastwave');
  });

  it('applies correct background color from scheme', () => {
    const svg = renderWaveSvg(simpleSeriesData, { schemeName: 'mosaic' });
    expect(svg).toContain((schemes as any).mosaic.backgroundColor);
  });

  it('has correct number of wave paths', () => {
    const svg = renderWaveSvg(simpleSeriesData);
    const pathCount = (svg.match(/class="wave"/g) || []).length;
    expect(pathCount).toBe(simpleSeriesData.length);
  });
});
