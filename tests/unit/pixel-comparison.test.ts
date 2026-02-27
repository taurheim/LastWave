import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import type SeriesData from '@/core/models/SeriesData';
import { simpleSeriesData, largeSeriesData } from '../fixtures/series-data';
import schemes from '@/core/config/schemes.json';
import { findLabelIndices } from '@/core/wave/util';
import type { MeasureTextFn } from '@/core/wave/util';
import { isWType, getWLabel } from '@/core/wave/waveW';
import { isXType, getXLabel } from '@/core/wave/waveX';
import { isYType, getYLabel } from '@/core/wave/waveY';
import { isZType, getZLabel } from '@/core/wave/waveZ';
import Peak from '@/core/models/Peak';
import type { StackPoint } from '@/core/models/Peak';

const mockMeasureText: MeasureTextFn = (text, _font, fontSize) => {
  const charWidth = fontSize * 0.6;
  const width = text.length * charWidth;
  const height = fontSize * 1.2;
  return { height, width, slope: height / width };
};

function generateSvgElement(seriesData: SeriesData[], schemeName = 'lastwave') {
  const numSegments = seriesData[0]?.counts.length ?? 0;
  const width = numSegments * 150;
  const height = 600;
  const scheme = (schemes as any)[schemeName] ?? (schemes as any).lastwave;
  const colors: string[] = scheme.schemeColors;

  const keys = seriesData.map((s) => s.title);
  const tableData: Record<string, number>[] = [];
  for (let i = 0; i < numSegments; i++) {
    const row: Record<string, number> = { index: i };
    seriesData.forEach((s) => { row[s.title] = s.counts[i] ?? 0; });
    tableData.push(row);
  }

  const stack = d3.stack<Record<string, number>>()
    .keys(keys)
    .offset(d3.stackOffsetSilhouette)
    .order(d3.stackOrderNone);

  const stackedData = stack(tableData);

  const xScale = d3.scaleLinear().domain([0, numSegments - 1]).range([0, width]);
  const yMin = d3.min(stackedData, (layer) => d3.min(layer, (d) => d[0])) ?? 0;
  const yMax = d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1])) ?? 0;
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

  return { stackedData, xScale, yScale, width, height, keys, colors, seriesData };
}

describe('Pixel-Proxy Structural Regression', () => {
  describe('SVG path geometry', () => {
    it('generates deterministic path data for simple dataset', () => {
      const { stackedData, xScale, yScale } = generateSvgElement(simpleSeriesData);

      const area = d3.area<[number, number]>()
        .x((_, i) => xScale(i))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]))
        .curve(d3.curveCardinal);

      const pathStrings = stackedData.map(layer => area(layer as any));

      pathStrings.forEach(p => {
        expect(p).toBeTruthy();
        expect(typeof p).toBe('string');
      });

      expect(pathStrings).toMatchSnapshot('simple-dataset-paths');
    });

    it('generates deterministic path data for large dataset', () => {
      const { stackedData, xScale, yScale } = generateSvgElement(largeSeriesData);

      const area = d3.area<[number, number]>()
        .x((_, i) => xScale(i))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]))
        .curve(d3.curveCardinal);

      const pathStrings = stackedData.map(layer => area(layer as any));
      expect(pathStrings).toMatchSnapshot('large-dataset-paths');
    });
  });

  describe('Stack layout values', () => {
    it('produces consistent y0/y1 values for simple dataset', () => {
      const { stackedData } = generateSvgElement(simpleSeriesData);

      const stackValues = stackedData.map(layer => ({
        key: layer.key,
        values: layer.map(d => ({ y0: Math.round(d[0] * 1000) / 1000, y1: Math.round(d[1] * 1000) / 1000 })),
      }));

      expect(stackValues).toMatchSnapshot('simple-stack-values');
    });

    it('produces consistent y0/y1 values for large dataset', () => {
      const { stackedData } = generateSvgElement(largeSeriesData);

      const stackValues = stackedData.map(layer => ({
        key: layer.key,
        values: layer.map(d => ({ y0: Math.round(d[0] * 1000) / 1000, y1: Math.round(d[1] * 1000) / 1000 })),
      }));

      expect(stackValues).toMatchSnapshot('large-stack-values');
    });
  });

  describe('Label placement', () => {
    it('places labels at consistent positions for simple dataset', () => {
      const { stackedData, xScale, yScale, keys } = generateSvgElement(simpleSeriesData);

      const labels: Array<{ text: string; x: number; y: number; fontSize: number }> = [];

      stackedData.forEach((layer, layerIndex) => {
        const counts = simpleSeriesData[layerIndex].counts;
        const stackPoints: StackPoint[] = layer.map((d, i) => ({
          x: xScale(i),
          y: yScale(d[0]) - yScale(d[1]),
          y0: yScale(d[1]),
        }));

        const labelIndices = findLabelIndices(counts, 2);
        labelIndices.forEach((idx) => {
          if (idx <= 0 || idx >= stackPoints.length - 1) return;
          const peak = new Peak(idx, stackPoints);
          let label = null;

          if (isWType(peak)) label = getWLabel(peak, keys[layerIndex], 'Roboto', mockMeasureText);
          else if (isZType(peak)) label = getZLabel(peak, keys[layerIndex], 'Roboto', mockMeasureText);
          else if (isYType(peak)) label = getYLabel(peak, keys[layerIndex], 'Roboto', mockMeasureText);
          else if (isXType(peak)) label = getXLabel(peak, keys[layerIndex], 'Roboto', mockMeasureText);

          if (label && label.fontSize >= 4) {
            labels.push({
              text: label.text,
              x: Math.round(label.xPosition * 100) / 100,
              y: Math.round(label.yPosition * 100) / 100,
              fontSize: Math.round(label.fontSize * 100) / 100,
            });
          }
        });
      });

      expect(labels).toMatchSnapshot('simple-label-positions');
    });

    it('places labels at consistent positions for large dataset', () => {
      const { stackedData, xScale, yScale, keys } = generateSvgElement(largeSeriesData);

      const labels: Array<{ text: string; x: number; y: number; fontSize: number }> = [];

      stackedData.forEach((layer, layerIndex) => {
        const counts = largeSeriesData[layerIndex].counts;
        const stackPoints: StackPoint[] = layer.map((d, i) => ({
          x: xScale(i),
          y: yScale(d[0]) - yScale(d[1]),
          y0: yScale(d[1]),
        }));

        const segmentsBetweenLabels = Math.max(2, Math.floor(largeSeriesData[0].counts.length / 5));
        const labelIndices = findLabelIndices(counts, segmentsBetweenLabels);
        labelIndices.forEach((idx) => {
          if (idx <= 0 || idx >= stackPoints.length - 1) return;
          const peak = new Peak(idx, stackPoints);
          let label = null;

          if (isWType(peak)) label = getWLabel(peak, keys[layerIndex], 'Roboto', mockMeasureText);
          else if (isZType(peak)) label = getZLabel(peak, keys[layerIndex], 'Roboto', mockMeasureText);
          else if (isYType(peak)) label = getYLabel(peak, keys[layerIndex], 'Roboto', mockMeasureText);
          else if (isXType(peak)) label = getXLabel(peak, keys[layerIndex], 'Roboto', mockMeasureText);

          if (label && label.fontSize >= 4) {
            labels.push({
              text: label.text,
              x: Math.round(label.xPosition * 100) / 100,
              y: Math.round(label.yPosition * 100) / 100,
              fontSize: Math.round(label.fontSize * 100) / 100,
            });
          }
        });
      });

      expect(labels).toMatchSnapshot('large-label-positions');
    });
  });

  describe('Color scheme application', () => {
    it('assigns correct colors from scheme to each series', () => {
      Object.keys(schemes).forEach(schemeName => {
        const { stackedData, colors } = generateSvgElement(simpleSeriesData, schemeName);
        const assignedColors = stackedData.map((_, i) => colors[i % colors.length]);
        expect(assignedColors.length).toBe(simpleSeriesData.length);
        assignedColors.forEach(c => {
          expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });
      });
    });
  });

  describe('Dimensions', () => {
    it('calculates correct default dimensions', () => {
      const { width, height } = generateSvgElement(simpleSeriesData);
      expect(width).toBe(simpleSeriesData[0].counts.length * 150);
      expect(height).toBe(600);
    });

    it('scales correctly for different dataset sizes', () => {
      const simple = generateSvgElement(simpleSeriesData);
      const large = generateSvgElement(largeSeriesData);

      expect(large.width).toBeGreaterThan(simple.width);
      expect(large.height).toBe(simple.height);
    });
  });
});
