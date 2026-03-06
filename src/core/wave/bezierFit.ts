/**
 * Bezier-Aware Inscribed Rectangle Label Placement
 *
 * Reconstructs the actual d3.curveMonotoneX Bezier curves from a Peak's
 * 3-point boundaries, then uses bisection search (inspired by d3-area-label)
 * to find the largest axis-aligned text rectangle that fits within the
 * curved boundaries.
 *
 * Key mathematical insight: for d3.curveMonotoneX, the x-component of each
 * cubic Bezier segment is LINEAR in parameter t. This means we can evaluate
 * the curve's y-value at any x directly: t = (x - x_start) / (x_end - x_start),
 * then compute y via the cubic Bezier formula.
 */

import Peak from '../models/Peak';
import Label from '../models/Label';
import type { MeasureTextFn } from './util';

// ---------------------------------------------------------------------------
// D3 curveMonotoneX tangent reconstruction (matches d3-shape/src/curve/monotone.js)
// ---------------------------------------------------------------------------

/**
 * Steffen method for interior tangent (matches d3's slope3).
 * Computes the tangent at point 1 given three consecutive points.
 */
function slopeInterior(h0: number, h1: number, s0: number, s1: number): number {
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  const sign0 = s0 < 0 ? -1 : 1;
  const sign1 = s1 < 0 ? -1 : 1;
  return ((sign0 + sign1) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p))) || 0;
}

/**
 * Endpoint tangent (matches d3's slope2).
 * Given the secant slope and the neighboring interior tangent,
 * computes the endpoint tangent.
 */
function slopeEndpoint(secant: number, interiorTangent: number): number {
  return (3 * secant - interiorTangent) / 2;
}

// ---------------------------------------------------------------------------
// Cubic Bezier evaluation
// ---------------------------------------------------------------------------

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// ---------------------------------------------------------------------------
// Curve parameter computation and evaluation
// ---------------------------------------------------------------------------

interface CurveParams {
  x0: number; y0: number;
  x1: number; y1: number;
  x2: number; y2: number;
  m0: number; m1: number; m2: number;
}

/**
 * Compute the d3.curveMonotoneX tangents for 3 points.
 */
function computeCurveParams(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
): CurveParams {
  const h0 = x1 - x0;
  const h1 = x2 - x1;
  const s0 = h0 !== 0 ? (y1 - y0) / h0 : 0;
  const s1 = h1 !== 0 ? (y2 - y1) / h1 : 0;

  const m1 = (h0 + h1) !== 0 ? slopeInterior(h0, h1, s0, s1) : 0;
  // Use secant slopes for endpoint tangents instead of d3's slope2 formula.
  // Our 3-point window's endpoints are actually interior points of the full
  // data series, so slope2 (designed for series endpoints) can overshoot.
  // Using secant slopes is conservative and prevents outward bowing.
  let m0 = s0;
  let m2 = s1;

  return { x0, y0, x1, y1, x2, y2, m0, m1, m2 };
}

/**
 * Evaluate the reconstructed d3.curveMonotoneX y-value at pixel x.
 *
 * Since the x-component of each Bezier segment is linear in t,
 * we directly compute t = (x - segStart) / (segEnd - segStart).
 */
function evalCurveY(c: CurveParams, x: number): number {
  if (x <= c.x0) return c.y0;
  if (x >= c.x2) return c.y2;

  if (x <= c.x1) {
    const h = c.x1 - c.x0;
    if (h <= 0) return c.y0;
    const t = (x - c.x0) / h;
    const dx = h / 3;
    return cubicBezier(c.y0, c.y0 + dx * c.m0, c.y1 - dx * c.m1, c.y1, t);
  } else {
    const h = c.x2 - c.x1;
    if (h <= 0) return c.y1;
    const t = (x - c.x1) / h;
    const dx = h / 3;
    return cubicBezier(c.y1, c.y1 + dx * c.m1, c.y2 - dx * c.m2, c.y2, t);
  }
}

// ---------------------------------------------------------------------------
// Inscribed rectangle search with bisection
// ---------------------------------------------------------------------------

/**
 * Find the largest axis-aligned text rectangle that fits within the
 * Bezier-bounded peak region.
 *
 * Algorithm:
 * 1. Reconstruct d3.curveMonotoneX Bezier curves from Peak's 3 top and 3 bottom points
 * 2. Pre-compute boundary values at each integer x, with safety margin
 * 3. Binary search (bisection) on font size
 * 4. For each candidate font size, slide a window of textWidth across all x positions
 *    checking whether min(topBound) - max(botBound) >= textHeight
 * 5. Among all valid positions, choose the one with maximum vertical slack (best fit)
 * 6. Position the baseline with descent offset for correct vertical alignment
 */
export function findOptimalLabel(
  peak: Peak,
  text: string,
  font: string,
  measureText: MeasureTextFn,
): Label | null {
  const MIN_FONT = 2;
  // Safety margin based on center band height, applied uniformly.
  // This ensures consistent absolute protection across the peak width,
  // especially near edges where the band is narrow but the actual Bezier
  // can deviate significantly from our 3-point reconstruction.
  const MARGIN_FRAC = 0.04; // fraction of center band height per side
  // Fraction of fontSize reserved for descent (text below baseline)
  const DESCENT_FRAC = 0.28;

  // Reconstruct Bezier curves for top and bottom boundaries
  const topCurve = computeCurveParams(
    peak.topLeft.x, peak.topLeft.y,
    peak.top.x, peak.top.y,
    peak.topRight.x, peak.topRight.y,
  );
  const botCurve = computeCurveParams(
    peak.bottomLeft.x, peak.bottomLeft.y,
    peak.bottom.x, peak.bottom.y,
    peak.bottomRight.x, peak.bottomRight.y,
  );

  // Valid x range (intersection of top and bottom curve domains)
  const xMin = Math.ceil(Math.max(topCurve.x0, botCurve.x0));
  const xMax = Math.floor(Math.min(topCurve.x2, botCurve.x2));
  const span = xMax - xMin;
  if (span < 1) return null;

  // Absolute margin from center band height
  const centerH = peak.top.y - peak.bottom.y;
  const absMargin = centerH * MARGIN_FRAC;

  // Pre-compute boundary values at integer x positions
  const topVals = new Float64Array(span + 1);
  const botVals = new Float64Array(span + 1);
  let maxAvailH = 0;

  for (let i = 0; i <= span; i++) {
    const px = xMin + i;
    const tY = evalCurveY(topCurve, px);
    const bY = evalCurveY(botCurve, px);
    // Constant absolute margin ensures protection even at narrow band edges
    topVals[i] = tY - absMargin;
    botVals[i] = bY + absMargin;
    const effH = topVals[i] - botVals[i];
    if (effH > maxAvailH) maxAvailH = effH;
  }

  if (maxAvailH < MIN_FONT) return null;

  // Measure text once at a reference size and scale linearly
  const REF_SIZE = 32;
  const refDims = measureText(text, font, REF_SIZE);
  const widthPerPx = refDims.width / REF_SIZE;   // width = fontSize * widthPerPx
  const heightPerPx = refDims.height / REF_SIZE;  // height = fontSize * heightPerPx

  // Binary search on font size
  const maxFont = Math.floor(maxAvailH / heightPerPx) + 1;
  let lo = MIN_FONT;
  let hi = Math.min(maxFont, 500);
  let bestFontSize = 0;
  let bestXPos = 0;
  let bestYPos = 0;

  // Pre-allocate deque buffer for sliding window min/max
  const n = span + 1;
  const deque = new Int32Array(n);
  const topMins = new Float64Array(n);
  const botMaxs = new Float64Array(n);

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const textW = mid * widthPerPx;
    const textH = mid * heightPerPx;
    const wPx = Math.ceil(textW);

    if (wPx > span) {
      hi = mid - 1;
      continue;
    }

    const windowSize = wPx + 1;
    const numWindows = n - windowSize + 1;

    // Sliding window minimum of topVals
    let front = 0, back = 0;
    for (let i = 0; i < n; i++) {
      while (front < back && deque[front] <= i - windowSize) front++;
      while (front < back && topVals[deque[back - 1]] >= topVals[i]) back--;
      deque[back++] = i;
      if (i >= windowSize - 1) topMins[i - windowSize + 1] = topVals[deque[front]];
    }

    // Sliding window maximum of botVals
    front = 0; back = 0;
    for (let i = 0; i < n; i++) {
      while (front < back && deque[front] <= i - windowSize) front++;
      while (front < back && botVals[deque[back - 1]] <= botVals[i]) back--;
      deque[back++] = i;
      if (i >= windowSize - 1) botMaxs[i - windowSize + 1] = botVals[deque[front]];
    }

    // Find best position using precomputed sliding min/max
    let found = false;
    let bestSlack = -1;
    let bx = 0;
    let by = 0;

    for (let si = 0; si < numWindows; si++) {
      const minT = topMins[si];
      const maxB = botMaxs[si];
      const slack = minT - maxB - textH;
      if (slack >= 0 && slack > bestSlack) {
        bestSlack = slack;
        bx = xMin + si;
        const minBaseline = maxB + DESCENT_FRAC * mid;
        const maxBaseline = minT - (1.0 - DESCENT_FRAC) * mid;
        by = (minBaseline + maxBaseline) / 2;
        by = Math.max(minBaseline, Math.min(maxBaseline, by));
        found = true;
      }
    }

    if (found) {
      bestFontSize = mid;
      bestXPos = bx;
      bestYPos = by;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (bestFontSize < MIN_FONT) return null;

  return new Label(text, bestXPos, bestYPos, font, bestFontSize);
}
