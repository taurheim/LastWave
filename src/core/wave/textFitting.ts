/**
 * Polygon-based text fitting using polylabel and monotone cubic interpolation.
 * Computes actual d3.curveMonotoneX positions to accurately model band boundaries.
 */
import polylabel from 'polylabel';
import Peak from '../models/Peak';
import type { StackPoint } from '../models/Peak';
import Label from '../models/Label';
import type { MeasureTextFn } from './util';

interface Edge {
  x1: number; y1: number;
  x2: number; y2: number;
}

function getEdges(polygon: number[][]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    edges.push({
      x1: polygon[i][0], y1: polygon[i][1],
      x2: polygon[j][0], y2: polygon[j][1],
    });
  }
  return edges;
}

function getHorizontalBounds(y: number, edges: Edge[]): { left: number; right: number } | null {
  const xs: number[] = [];
  for (const e of edges) {
    if (e.y1 === e.y2) continue;
    const t = (y - e.y1) / (e.y2 - e.y1);
    if (t >= 0 && t <= 1) {
      xs.push(e.x1 + t * (e.x2 - e.x1));
    }
  }
  if (xs.length < 2) return null;
  return { left: Math.min(...xs), right: Math.max(...xs) };
}

function getVerticalBounds(x: number, edges: Edge[]): { bottom: number; top: number } | null {
  const ys: number[] = [];
  for (const e of edges) {
    if (e.x1 === e.x2) continue;
    const t = (x - e.x1) / (e.x2 - e.x1);
    if (t >= 0 && t <= 1) {
      ys.push(e.y1 + t * (e.y2 - e.y1));
    }
  }
  if (ys.length < 2) return null;
  return { bottom: Math.min(...ys), top: Math.max(...ys) };
}

/**
 * Compute monotone cubic tangents matching d3.curveMonotoneX's slope3/slope2 functions.
 */
function computeMonotoneTangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  if (n < 2) return new Array(n).fill(0);

  const m: number[] = new Array(n).fill(0);

  if (n === 2) {
    const s = (ys[1] - ys[0]) / (xs[1] - xs[0] || 1);
    m[0] = s;
    m[1] = s;
    return m;
  }

  // Interior tangents: matching d3's slope3 function
  for (let i = 1; i < n - 1; i++) {
    const h0 = xs[i] - xs[i - 1];
    const h1 = xs[i + 1] - xs[i];
    const s0 = h0 !== 0 ? (ys[i] - ys[i - 1]) / h0 : 0;
    const s1 = h1 !== 0 ? (ys[i + 1] - ys[i]) / h1 : 0;
    const p = (h0 + h1) !== 0 ? (s0 * h1 + s1 * h0) / (h0 + h1) : 0;
    const signSum = Math.sign(s0) + Math.sign(s1);
    m[i] = signSum === 0 ? 0 : signSum * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
  }

  // Endpoint tangents: matching d3's slope2 function
  const h0 = xs[1] - xs[0];
  m[0] = h0 !== 0 ? (3 * (ys[1] - ys[0]) / h0 - m[1]) / 2 : m[1];

  const hn = xs[n - 1] - xs[n - 2];
  m[n - 1] = hn !== 0 ? (3 * (ys[n - 1] - ys[n - 2]) / hn - m[n - 2]) / 2 : m[n - 2];

  return m;
}

/**
 * Evaluate cubic Hermite spline at parameter t ∈ [0, 1] between points k and k+1.
 */
function hermiteEval(y0: number, y1: number, m0: number, m1: number, h: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0
    + (t3 - 2 * t2 + t) * h * m0
    + (-2 * t3 + 3 * t2) * y1
    + (t3 - t2) * h * m1;
}

/**
 * Build a dense polygon from the peak using actual monotone cubic curves.
 * Uses the stack data stored in the peak for accurate interpolation.
 */
export function buildDensePolygon(peak: Peak, samplesPerSegment: number = 12): number[][] {
  const stack = peak.stackData;
  const idx = peak.stackIndex;

  if (!stack || stack.length < 2) {
    return buildSimplePolygon(peak);
  }

  // Gather points for interpolation: index-2 to index+2 (clamped)
  const startIdx = Math.max(0, idx - 2);
  const endIdx = Math.min(stack.length - 1, idx + 2);

  const xs: number[] = [];
  const topYs: number[] = [];
  const botYs: number[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    xs.push(stack[i].x);
    topYs.push(stack[i].y + stack[i].y0);
    botYs.push(stack[i].y0);
  }

  const topTangents = computeMonotoneTangents(xs, topYs);
  const botTangents = computeMonotoneTangents(xs, botYs);

  // Interpolate the two segments: [idx-1, idx] and [idx, idx+1]
  const topPoints: number[][] = [];
  const botPoints: number[][] = [];

  const localLeft = Math.max(0, idx - 1) - startIdx;
  const localCenter = idx - startIdx;
  const localRight = Math.min(stack.length - 1, idx + 1) - startIdx;

  // Left segment: idx-1 to idx
  if (localLeft < localCenter) {
    const h = xs[localCenter] - xs[localLeft];
    if (h > 0) {
      for (let s = 0; s <= samplesPerSegment; s++) {
        const t = s / samplesPerSegment;
        const x = xs[localLeft] + t * h;
        const topY = hermiteEval(topYs[localLeft], topYs[localCenter], topTangents[localLeft], topTangents[localCenter], h, t);
        const botY = hermiteEval(botYs[localLeft], botYs[localCenter], botTangents[localLeft], botTangents[localCenter], h, t);
        topPoints.push([x, topY]);
        botPoints.push([x, botY]);
      }
    }
  } else {
    topPoints.push([peak.top.x, peak.top.y]);
    botPoints.push([peak.bottom.x, peak.bottom.y]);
  }

  // Right segment: idx to idx+1
  if (localCenter < localRight) {
    const h = xs[localRight] - xs[localCenter];
    if (h > 0) {
      for (let s = 1; s <= samplesPerSegment; s++) {
        const t = s / samplesPerSegment;
        const x = xs[localCenter] + t * h;
        const topY = hermiteEval(topYs[localCenter], topYs[localRight], topTangents[localCenter], topTangents[localRight], h, t);
        const botY = hermiteEval(botYs[localCenter], botYs[localRight], botTangents[localCenter], botTangents[localRight], h, t);
        topPoints.push([x, topY]);
        botPoints.push([x, botY]);
      }
    }
  }

  // Build polygon: top curve (left to right) + bottom curve (right to left)
  const polygon: number[][] = [];
  for (const p of topPoints) polygon.push(p);
  for (let i = botPoints.length - 1; i >= 0; i--) polygon.push(botPoints[i]);

  return polygon.length >= 3 ? polygon : buildSimplePolygon(peak);
}

/**
 * Simple 6-point polygon fallback.
 */
function buildSimplePolygon(peak: Peak): number[][] {
  return [
    [peak.topLeft.x, peak.topLeft.y],
    [peak.top.x, peak.top.y],
    [peak.topRight.x, peak.topRight.y],
    [peak.bottomRight.x, peak.bottomRight.y],
    [peak.bottom.x, peak.bottom.y],
    [peak.bottomLeft.x, peak.bottomLeft.y],
  ];
}

/**
 * Find optimal text placement inside a peak polygon using scanning.
 * Uses dense polygon from monotone cubic interpolation for accuracy.
 */
export function fitTextInPeak(
  peak: Peak,
  text: string,
  font: string,
  measureText: MeasureTextFn,
): Label | null {
  const SAFETY = 0.84;
  const EFFECTIVE_HEIGHT_FACTOR = 1.42;
  const MIN_FONT = 5;

  const polygon = buildDensePolygon(peak, 16);
  const edges = getEdges(polygon);

  const refDims = measureText(text, font, 100);
  const widthPerFont = refDims.width / 100;

  const allYs = polygon.map(p => p[1]);
  const bandBottom = Math.min(...allYs);
  const bandTop = Math.max(...allYs);
  const bandHeight = bandTop - bandBottom;

  if (bandHeight < 3) return null;

  let bestFontSize = 0;
  let bestY = (bandTop + bandBottom) / 2;

  const steps = Math.min(60, Math.max(10, Math.ceil(bandHeight / 2)));

  for (let i = 1; i < steps; i++) {
    const testY = bandBottom + bandHeight * i / steps;

    const hBounds = getHorizontalBounds(testY, edges);
    if (!hBounds || hBounds.right - hBounds.left < 5) continue;

    const centerX = (hBounds.left + hBounds.right) / 2;
    const vBounds = getVerticalBounds(centerX, edges);
    if (!vBounds || vBounds.top - vBounds.bottom < 3) continue;

    const availHeight = (vBounds.top - vBounds.bottom) * SAFETY;
    const maxFontFromHeight = availHeight / EFFECTIVE_HEIGHT_FACTOR;

    // Check minimum width across text's vertical extent
    const estTextHeight = maxFontFromHeight * EFFECTIVE_HEIGHT_FACTOR;
    const textTop = Math.min(testY + estTextHeight * 0.55, bandTop - 0.5);
    const textBot = Math.max(testY - estTextHeight * 0.55, bandBottom + 0.5);

    let minWidth = hBounds.right - hBounds.left;
    const hTop = getHorizontalBounds(textTop, edges);
    if (hTop) minWidth = Math.min(minWidth, hTop.right - hTop.left);
    const hBot = getHorizontalBounds(textBot, edges);
    if (hBot) minWidth = Math.min(minWidth, hBot.right - hBot.left);

    const availWidth = minWidth * SAFETY;
    const maxFontFromWidth = availWidth / widthPerFont;

    const fontSize = Math.floor(Math.min(maxFontFromWidth, maxFontFromHeight));

    if (fontSize > bestFontSize) {
      bestFontSize = fontSize;
      bestY = testY;
    }
  }

  if (bestFontSize < MIN_FONT) return null;

  // Post-fit: simulate overflow and reduce font until overflow < threshold
  const hBounds = getHorizontalBounds(bestY, edges);
  if (!hBounds) return null;
  const centerX = (hBounds.left + hBounds.right) / 2;

  for (let attempt = 0; attempt < 4; attempt++) {
    const dims = measureText(text, font, bestFontSize);
    const textWidth = dims.width;
    const textLeft = centerX - textWidth / 2;
    const textRight = centerX + textWidth / 2;

    // Estimate baseline and text bounds in internal coords
    const baseline = bestY - dims.height * 0.27;
    // Conservative ink bounds estimate for DM Sans
    const estAscent = bestFontSize * 0.82;
    const estDescent = bestFontSize * 0.20;
    const textTopInternal = baseline + estAscent;
    const textBotInternal = baseline - estDescent;
    const textH = estAscent + estDescent;

    if (textH <= 0) break;

    // Simulate column-by-column overflow like the test does
    let overflowArea = 0;
    let totalArea = 0;
    const numChecks = 20;

    // Get polygon x-range
    const allXs = edges.map(e => e.x1).concat(edges.map(e => e.x2));
    const polyLeft = Math.min(...allXs);
    const polyRight = Math.max(...allXs);

    for (let j = 0; j <= numChecks; j++) {
      const checkX = textLeft + (textRight - textLeft) * j / numChecks;
      totalArea += textH;

      // Text outside polygon x-range counts as full overflow
      if (checkX < polyLeft || checkX > polyRight) {
        overflowArea += textH;
        continue;
      }

      const vb = getVerticalBounds(checkX, edges);
      if (!vb) {
        overflowArea += textH;
        continue;
      }
      const overTop = Math.max(0, textTopInternal - vb.top);
      const overBot = Math.max(0, vb.bottom - textBotInternal);
      overflowArea += Math.min(overTop + overBot, textH);
    }

    const overflowPct = totalArea > 0 ? (overflowArea / totalArea) * 100 : 0;

    if (overflowPct <= 5) break;  // Acceptable overflow

    // Reduce font proportionally to overflow
    const reduction = Math.max(1, Math.ceil(bestFontSize * overflowPct / 400));
    bestFontSize -= reduction;
    if (bestFontSize < MIN_FONT) return null;
  }

  const labelDims = measureText(text, font, bestFontSize);
  const labelX = centerX - labelDims.width / 2;
  const labelY = bestY - labelDims.height * 0.27;

  return new Label(text, labelX, labelY, font, bestFontSize);
}

/**
 * Constrain an existing label to fit within the peak polygon.
 * Simulates overflow and reduces font if needed. Falls back to fitTextInPeak if badly placed.
 */
export function constrainLabel(
  label: Label | null,
  peak: Peak,
  text: string,
  font: string,
  measureText: MeasureTextFn,
): Label | null {
  if (!label || label.fontSize < 5) return null;

  const polygon = buildDensePolygon(peak, 16);
  const edges = getEdges(polygon);

  // Get polygon x-range
  const allXs = edges.map(e => e.x1).concat(edges.map(e => e.x2));
  const polyLeft = Math.min(...allXs);
  const polyRight = Math.max(...allXs);

  let fontSize = label.fontSize;
  let labelX = label.xPosition;
  let labelY = label.yPosition;

  // Re-center position within the polygon
  const dims0 = measureText(text, font, fontSize);
  let textCenterX = labelX + dims0.width / 2;

  // Re-center x using polygon horizontal bounds at label's y-center
  const textCenterY = labelY + dims0.height * 0.35;
  const hCenter = getHorizontalBounds(textCenterY, edges);
  if (hCenter) {
    const bandCenterX = (hCenter.left + hCenter.right) / 2;
    labelX = bandCenterX - dims0.width / 2;
    textCenterX = bandCenterX;
  }

  // Re-center y using polygon vertical bounds at text center-x
  const vCenter = getVerticalBounds(textCenterX, edges);
  if (vCenter) {
    const bandCenterY = (vCenter.top + vCenter.bottom) / 2;
    labelY = bandCenterY - dims0.height * 0.27;
  }

  // Simulate overflow and reduce font until acceptable
  for (let attempt = 0; attempt < 5; attempt++) {
    const dims = measureText(text, font, fontSize);
    const textLeft = labelX;
    const textRight = labelX + dims.width;

    // Estimate ink bounds in internal coords
    const baseline = labelY;
    const estAscent = fontSize * 0.82;
    const estDescent = fontSize * 0.20;
    const textTopInternal = baseline + estAscent;
    const textBotInternal = baseline - estDescent;
    const textH = estAscent + estDescent;

    if (textH <= 0) break;

    let overflowArea = 0;
    let totalArea = 0;
    const numChecks = 20;

    for (let j = 0; j <= numChecks; j++) {
      const checkX = textLeft + (textRight - textLeft) * j / numChecks;
      totalArea += textH;

      if (checkX < polyLeft || checkX > polyRight) {
        overflowArea += textH;
        continue;
      }

      const vb = getVerticalBounds(checkX, edges);
      if (!vb) {
        overflowArea += textH;
        continue;
      }
      const overTop = Math.max(0, textTopInternal - vb.top);
      const overBot = Math.max(0, vb.bottom - textBotInternal);
      overflowArea += Math.min(overTop + overBot, textH);
    }

    const overflowPct = totalArea > 0 ? (overflowArea / totalArea) * 100 : 0;

    if (overflowPct <= 5) break;

    // If original position is very bad, try polylabel instead
    if (attempt === 0 && overflowPct > 30) {
      return fitTextInPeak(peak, text, font, measureText);
    }

    const reduction = Math.max(1, Math.ceil(fontSize * overflowPct / 400));
    fontSize -= reduction;
    if (fontSize < 5) return null;

    // Recenter with new dimensions
    const newDims = measureText(text, font, fontSize);
    const centerX = labelX + dims.width / 2;
    labelX = centerX - newDims.width / 2;
  }

  if (fontSize < 5) return null;

  // Choose the better of constrained original vs polylabel
  const polylabelResult = fitTextInPeak(peak, text, font, measureText);
  if (polylabelResult && polylabelResult.fontSize > fontSize) {
    return polylabelResult;
  }

  return new Label(text, labelX, labelY, font, fontSize);
}
