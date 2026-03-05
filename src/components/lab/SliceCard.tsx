import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import Peak from '@/core/models/Peak';
import type { StackPoint } from '@/core/models/Peak';
import type Label from '@/core/models/Label';
import { createCanvasMeasurer } from '@/core/wave/util';
import { isWType, getWLabel } from '@/core/wave/waveW';
import { isXType, getXLabel } from '@/core/wave/waveX';
import { isYType, getYLabel } from '@/core/wave/waveY';
import { isZType, getZLabel } from '@/core/wave/waveZ';
import { buildBandLUT } from '@/core/wave/overflowDetection';
import type { SliceDefinition } from './sliceData';

const CARD_W = 400;
const CARD_H = 220;
const FONT_FAMILY = 'DM Sans';
const FONT_COLOR = '#000000';
const BEZIER_FILL = 'rgba(39, 170, 225, 0.25)';
const BEZIER_STROKE = 'rgba(39, 170, 225, 0.6)';
const LINE_COLORS = { A: '#ef4444', B: '#f59e0b', C: '#22c55e', D: '#8b5cf6' };

function getAlgorithmType(peak: Peak): string {
  if (isWType(peak)) return 'W';
  if (isZType(peak)) return 'Z';
  if (isYType(peak)) return 'Y';
  if (isXType(peak)) return 'X';
  return '?';
}

function getLabel(peak: Peak, text: string, measureText: ReturnType<typeof createCanvasMeasurer>): Label | null {
  if (isWType(peak)) return getWLabel(peak, text, FONT_FAMILY, measureText);
  if (isZType(peak)) return getZLabel(peak, text, FONT_FAMILY, measureText);
  if (isYType(peak)) return getYLabel(peak, text, FONT_FAMILY, measureText);
  if (isXType(peak)) return getXLabel(peak, text, FONT_FAMILY, measureText);
  return null;
}


interface SliceCardProps {
  slice: SliceDefinition;
  showStraightLines: boolean;
  showBezier: boolean;
  onStatus?: (id: string, status: 'ok' | 'overflow' | 'hidden') => void;
}

export default function SliceCard({ slice, showStraightLines, showBezier, onStatus }: SliceCardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [algoType, setAlgoType] = useState('?');
  const [labelInfo, setLabelInfo] = useState<string>('');

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const measureText = createCanvasMeasurer();
    const points = slice.points;

    // Derive the coordinate space height from the data.
    // The y-flip origin must match the original graph's height.
    // For synthetic slices this is ~CARD_H; for real-world data it's 600.
    let dataMaxY = 0;
    for (const p of points) {
      const top = p.y0 + p.y;
      if (top > dataMaxY) dataMaxY = top;
      if (p.y0 > dataMaxY) dataMaxY = p.y0;
    }
    // Use the data's own coordinate ceiling (round up to nearest 50 for stability)
    const coordH = Math.max(CARD_H, Math.ceil(dataMaxY / 50) * 50);

    // Compute viewBox: zoom into the peak region
    const peakIdx = slice.peakIndex;
    // For real-world data (large coordinate space), use tighter focus (±1 index)
    // For synthetic data (small coordinate space), use wider focus (±2 indices)
    const isLargeCoords = coordH > CARD_H;
    const focusRadius = isLargeCoords ? 1 : 2;
    const focusStart = Math.max(0, peakIdx - focusRadius);
    const focusEnd = Math.min(points.length - 1, peakIdx + focusRadius);
    const focusPoints = points.slice(focusStart, focusEnd + 1);

    const xMin = focusPoints[0].x;
    const xMax = focusPoints[focusPoints.length - 1].x;
    const xRange = xMax - xMin || 1;

    // Find y bounds in the focus region (SVG coords: coordH - y0 is bottom, coordH - (y0+y) is top)
    let svgYMin = Infinity;
    let svgYMax = -Infinity;
    for (const p of focusPoints) {
      const top = coordH - (p.y0 + p.y);
      const bot = coordH - p.y0;
      if (top < svgYMin) svgYMin = top;
      if (bot > svgYMax) svgYMax = bot;
    }
    const yRange = svgYMax - svgYMin || 1;

    // Add padding — tighter for real-world data
    const padFrac = isLargeCoords ? 0.1 : 0.2;
    const padX = xRange * padFrac;
    const padY = yRange * padFrac;
    const vbX = xMin - padX;
    const vbY = svgYMin - padY;
    const vbW = xRange + padX * 2;
    const vbH = yRange + padY * 2;

    // Always use viewBox so data in any coordinate space renders correctly
    svg.attr('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');

    // Background
    svg.append('rect')
      .attr('x', vbX).attr('y', vbY)
      .attr('width', vbW).attr('height', vbH)
      .attr('fill', (() => {
        const rgb = getComputedStyle(document.documentElement).getPropertyValue('--lw-bg').trim();
        const parts = rgb.split(' ');
        return parts.length === 3 ? `rgb(${parts.join(',')})` : '#0c1117';
      })());

    // Adjust stroke widths for zoom level
    const zoomScale = vbW / CARD_W;

    // 1. Bezier curve area — always generate the path for overflow detection
    const areaGen = d3.area<StackPoint>()
      .x(d => d.x)
      .y0(d => coordH - d.y0)
      .y1(d => coordH - (d.y0 + d.y))
      .curve(d3.curveMonotoneX);

    const areaPathD = areaGen(points) ?? '';

    if (showBezier && areaPathD) {
      svg.append('path')
        .datum(points)
        .attr('d', areaGen)
        .attr('fill', BEZIER_FILL)
        .attr('stroke', BEZIER_STROKE)
        .attr('stroke-width', 1.5 * zoomScale);
    }

    // 2. Straight-line boundaries (what the algorithm sees)
    const peak = new Peak(slice.peakIndex, points);
    const type = getAlgorithmType(peak);
    setAlgoType(type);

    if (showStraightLines) {
      const lines: [string, { start: { x: number; y: number }; end: { x: number; y: number } }][] = [
        ['A', peak.A], ['B', peak.B], ['C', peak.C], ['D', peak.D],
      ];
      lines.forEach(([name, seg]) => {
        svg.append('line')
          .attr('x1', seg.start.x).attr('y1', coordH - seg.start.y)
          .attr('x2', seg.end.x).attr('y2', coordH - seg.end.y)
          .attr('stroke', LINE_COLORS[name as keyof typeof LINE_COLORS])
          .attr('stroke-width', 1.5 * zoomScale)
          .attr('stroke-dasharray', `${4 * zoomScale},${3 * zoomScale}`)
          .attr('opacity', 0.7);
      });

      // Peak point markers
      [peak.top, peak.bottom, peak.topLeft, peak.topRight, peak.bottomLeft, peak.bottomRight].forEach(pt => {
        svg.append('circle')
          .attr('cx', pt.x).attr('cy', coordH - pt.y)
          .attr('r', 3 * zoomScale)
          .attr('fill', '#fff')
          .attr('opacity', 0.5);
      });
    }

    // 3. Position and draw text label, detect overflow
    const label = getLabel(peak, slice.label, measureText);
    if (label) {
      // Check for Infinity/NaN in label position (hidden/broken label)
      const hasInvalid = !isFinite(label.xPosition) || !isFinite(label.yPosition) || !isFinite(label.fontSize);

      if (hasInvalid) {
        setLabelInfo('∞');
        onStatus?.(slice.id, 'hidden');
      } else {
        // SVG text y = baseline position
        const baselineSvgY = coordH - label.yPosition;

        svg.append('text')
          .attr('x', label.xPosition)
          .attr('y', baselineSvgY)
          .attr('font-size', `${label.fontSize}px`)
          .attr('font-family', FONT_FAMILY)
          .attr('fill', FONT_COLOR)
          .text(label.text);

        // Get precise text bounds using canvas metrics (ascent/descent from baseline)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        ctx.font = `${label.fontSize}px ${FONT_FAMILY}`;
        const metrics = ctx.measureText(label.text);
        const ascent = metrics.actualBoundingBoxAscent;
        const descent = metrics.actualBoundingBoxDescent;
        const textWidth = metrics.width;
        const textTop = baselineSvgY - ascent;
        const textBot = baselineSvgY + descent;

        svg.append('rect')
          .attr('x', label.xPosition)
          .attr('y', textTop)
          .attr('width', textWidth)
          .attr('height', ascent + descent)
          .attr('fill', 'none')
          .attr('stroke', 'rgba(255,255,255,0.2)')
          .attr('stroke-width', 0.5 * zoomScale)
          .attr('stroke-dasharray', `${2 * zoomScale},${2 * zoomScale}`);

        // Detect Bezier overflow by sampling the area path
        let overflowPx = 0;
        let overflowArea = 0;
        const textHeight = ascent + descent;
        const textLeft = Math.floor(label.xPosition);
        const textRight = Math.ceil(label.xPosition + textWidth);
        const totalArea = (textRight - textLeft + 1) * textHeight;
        if (areaPathD) {
          const bandLUT = buildBandLUT(areaPathD, points[points.length - 1].x);
          if (bandLUT) {
            // Pixels outside the band's x range are fully overflowing
            const clampedL = Math.max(0, textLeft);
            const clampedR = Math.min(bandLUT.length - 1, textRight);
            const outsideLeft = Math.max(0, -textLeft);
            const outsideRight = Math.max(0, textRight - (bandLUT.length - 1));
            overflowArea += (outsideLeft + outsideRight) * textHeight;

            for (let px = clampedL; px <= clampedR; px++) {
              const b = bandLUT[px];
              if (!b) {
                overflowArea += textHeight;
                continue;
              }
              const overTop = Math.max(0, b.top - textTop);
              const overBot = Math.max(0, textBot - b.bot);
              overflowPx = Math.max(overflowPx, overTop, overBot);
              overflowArea += Math.min(overTop + overBot, textHeight);
            }
          }
        }

        const overflowPct = totalArea > 0 ? Math.round((overflowArea / totalArea) * 100) : 0;

        if (overflowPx > 1) {
          setLabelInfo(`${Math.round(label.fontSize)}px ⚠${Math.round(overflowPx)}px (${overflowPct}%)`);
          onStatus?.(slice.id, 'overflow');
        } else {
          setLabelInfo(`${Math.round(label.fontSize)}px`);
          onStatus?.(slice.id, 'ok');
        }
      }
    } else {
      setLabelInfo('no fit');
      onStatus?.(slice.id, 'hidden');
    }
  }, [slice, showStraightLines, showBezier]);

  const typeBadgeColors: Record<string, string> = {
    W: 'bg-red-500/20 text-red-400 border-red-500/30',
    X: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Y: 'bg-green-500/20 text-green-400 border-green-500/30',
    Z: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    '?': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <div className="rounded-xl border border-lw-border bg-lw-surface/30 overflow-hidden">
      <svg ref={svgRef} width={CARD_W} height={CARD_H} className="block" />
      <div className="flex items-center justify-between px-3 py-2 border-t border-lw-border/50">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${typeBadgeColors[algoType]}`}>
            {algoType}
          </span>
          <span className="text-[11px] text-lw-muted font-mono">{slice.id}</span>
        </div>
        <span className="text-[10px] text-lw-muted/60 max-w-[200px] truncate" title={slice.description}>
          {slice.description}
        </span>
        <span className="text-[10px] text-lw-muted font-mono">{labelInfo}</span>
      </div>
    </div>
  );
}
