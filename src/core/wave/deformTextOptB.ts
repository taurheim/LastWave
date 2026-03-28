/**
 * Deformed text computation — Approach B: Pure JS Spline.
 *
 * Eliminates SVG DOM dependency by building a monotone Hermite spline
 * internally from bandData. getPointAtLength / lengthAtX are computed
 * directly from the spline, avoiding any external path geometry.
 */
import type { MeasureTextFn } from './util';
import type { Label } from '../models/Label';
import type { BandPoint, CharPlacement, DeformResult } from './deformText';

const MAX_ANGLE = 30;
const BAND_MARGIN = 0.92;
const SAMPLES_PER_SEG = 20;

// ── Monotone Hermite spline helpers ─────────────────────────────────

function monotoneSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const slopes = new Float64Array(n);
  if (n < 2) return Array.from(slopes);

  const deltas: number[] = [];
  const secants: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    deltas.push(xs[i + 1] - xs[i]);
    secants.push((ys[i + 1] - ys[i]) / deltas[i]);
  }

  slopes[0] = secants[0];
  for (let i = 1; i < n - 1; i++) {
    if (secants[i - 1] * secants[i] > 0) {
      slopes[i] = 3 * (deltas[i - 1] + deltas[i]) /
        ((2 * deltas[i] + deltas[i - 1]) / secants[i - 1] +
         (deltas[i] + 2 * deltas[i - 1]) / secants[i]);
    }
  }
  slopes[n - 1] = secants[n - 2];
  return Array.from(slopes);
}

function hermitePoint(x0: number, y0: number, x1: number, y1: number,
                      m0: number, m1: number, t: number): { x: number; y: number } {
  const h = x1 - x0;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return {
    x: x0 + t * h,
    y: h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1,
  };
}

// ── Internal spline structure ───────────────────────────────────────

interface InternalSpline {
  getPointAtLength(len: number): { x: number; y: number };
  totalLen: number;
  lengthAtX(x: number): number;
}

function buildInternalSpline(bandData: BandPoint[]): InternalSpline {
  const n = bandData.length;
  if (n < 2) {
    const pt = n === 1 ? { x: bandData[0].x, y: bandData[0].centerY } : { x: 0, y: 0 };
    return {
      getPointAtLength: () => ({ ...pt }),
      totalLen: 0,
      lengthAtX: () => 0,
    };
  }

  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = bandData[i].x;
    ys[i] = bandData[i].centerY;
  }

  const slopes = monotoneSlopes(Array.from(xs), Array.from(ys));

  // Pre-compute cumulative arc lengths with fine sampling
  const segCount = n - 1;
  const cumLens = new Float64Array(n); // cumLens[0] = 0

  // Also store per-sample arc lengths for faster getPointAtLength
  // sampleCumLens[seg][s] = cumulative length from start of spline to sample s of segment seg
  const sampleCumLens: Float64Array[] = new Array(segCount);

  for (let i = 0; i < segCount; i++) {
    const samples = new Float64Array(SAMPLES_PER_SEG + 1);
    samples[0] = cumLens[i];
    let prevX = xs[i], prevY = ys[i];
    for (let s = 1; s <= SAMPLES_PER_SEG; s++) {
      const t = s / SAMPLES_PER_SEG;
      const pt = hermitePoint(xs[i], ys[i], xs[i + 1], ys[i + 1], slopes[i], slopes[i + 1], t);
      const dx = pt.x - prevX;
      const dy = pt.y - prevY;
      samples[s] = samples[s - 1] + Math.sqrt(dx * dx + dy * dy);
      prevX = pt.x;
      prevY = pt.y;
    }
    sampleCumLens[i] = samples;
    cumLens[i + 1] = samples[SAMPLES_PER_SEG];
  }

  const totalLen = cumLens[n - 1];

  function getPointAtLength(len: number): { x: number; y: number } {
    if (len <= 0) return { x: xs[0], y: ys[0] };
    if (len >= totalLen) return { x: xs[n - 1], y: ys[n - 1] };

    // Binary search for segment
    let lo = 0, hi = segCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumLens[mid + 1] < len) lo = mid + 1; else hi = mid;
    }
    const seg = lo;

    // Binary search within segment samples for sub-sample precision
    const samples = sampleCumLens[seg];
    let sLo = 0, sHi = SAMPLES_PER_SEG;
    while (sLo < sHi) {
      const sMid = (sLo + sHi) >> 1;
      if (samples[sMid + 1] < len) sLo = sMid + 1; else sHi = sMid;
    }

    // Linearly interpolate t within this sub-sample interval
    const lenStart = samples[sLo];
    const lenEnd = samples[sLo + 1] ?? samples[sLo];
    const frac = lenEnd > lenStart ? (len - lenStart) / (lenEnd - lenStart) : 0;
    const t = (sLo + frac) / SAMPLES_PER_SEG;

    return hermitePoint(xs[seg], ys[seg], xs[seg + 1], ys[seg + 1], slopes[seg], slopes[seg + 1], t);
  }

  function lengthAtX(targetX: number): number {
    if (targetX <= xs[0]) return 0;
    if (targetX >= xs[n - 1]) return totalLen;

    // Direct segment lookup: find which segment contains targetX
    let seg = 0;
    for (seg = 0; seg < segCount - 1; seg++) {
      if (xs[seg + 1] >= targetX) break;
    }

    // Since x is monotonically increasing with t in monotone Hermite,
    // solve for t analytically via bisection within the segment
    const x0 = xs[seg], y0 = ys[seg];
    const x1 = xs[seg + 1], y1 = ys[seg + 1];
    const m0 = slopes[seg], m1 = slopes[seg + 1];

    // Bisect for t such that hermitePoint(..., t).x == targetX
    let tLo = 0, tHi = 1;
    for (let iter = 0; iter < 20; iter++) {
      const tMid = (tLo + tHi) * 0.5;
      const px = x0 + tMid * (x1 - x0); // x is linear in t for monotone Hermite
      if (px < targetX) tLo = tMid; else tHi = tMid;
    }
    const tSolved = (tLo + tHi) * 0.5;

    // Compute arc length from segment start to tSolved using samples
    const samples = sampleCumLens[seg];
    const sampleIdx = tSolved * SAMPLES_PER_SEG;
    const sFloor = Math.min(SAMPLES_PER_SEG - 1, Math.floor(sampleIdx));
    const sFrac = sampleIdx - sFloor;
    return samples[sFloor] + sFrac * (samples[sFloor + 1] - samples[sFloor]);
  }

  return { getPointAtLength, totalLen, lengthAtX };
}

// ── Band interpolation ─────────────────────────────────────────────

function bandAtX(bandData: BandPoint[], bandX0: number, bandXStep: number, x: number) {
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

// ── Main function ───────────────────────────────────────────────────

/**
 * Compute deformed-text character placements using a built-in JS spline.
 * No external SVG path geometry required.
 */
export function computeDeformedText(
  label: Label,
  bandData: BandPoint[],
  peakIdx: number,
  peakX: number,
  fontFamily: string,
  measureText: MeasureTextFn,
  bandBoundsAtX?: (x: number) => { topY: number; botY: number; thickness: number },
  jitter: boolean = true,
): DeformResult {
  if (bandData.length < 2) {
    return { placements: [], overflowFraction: 0, avgFontSizeRatio: 0 };
  }

  const spline = buildInternalSpline(bandData);
  const { getPointAtLength, totalLen, lengthAtX } = spline;

  const bandXStep = bandData[1].x - bandData[0].x;
  const bandX0 = bandData[0].x;
  const firstBandX = bandData[0].x;
  const lastBandX = bandData[bandData.length - 1].x;

  const text = label.text;
  const baseFontSize = label.fontSize;
  const peakThickness = bandData[peakIdx]?.thickness ?? 1;
  const renderFontSize = baseFontSize * 1.15;

  const approxCharWidth = renderFontSize * 0.55;
  const approxTotalWidth = text.length * approxCharWidth;

  // Find the viable region where band is thick enough for readable text.
  // Search outward from the peak to find where thickness drops below threshold.
  const VIABLE_FRAC = 0.20;
  let viableLeftIdx = 0;
  let viableRightIdx = bandData.length - 1;
  for (let i = peakIdx; i >= 0; i--) {
    if (bandData[i].thickness / (peakThickness || 1) < VIABLE_FRAC) {
      viableLeftIdx = Math.min(i + 1, bandData.length - 1);
      break;
    }
  }
  for (let i = peakIdx; i < bandData.length; i++) {
    if (bandData[i].thickness / (peakThickness || 1) < VIABLE_FRAC) {
      viableRightIdx = Math.max(i - 1, 0);
      break;
    }
  }
  const viableLeft = bandData[viableLeftIdx].x;
  const viableRight = bandData[viableRightIdx].x;

  // Thickness-weighted centroid within the viable region
  let weightedXSum = 0, weightSum = 0;
  for (let i = viableLeftIdx; i <= viableRightIdx; i++) {
    const bd = bandData[i];
    const thickFrac = bd.thickness / (peakThickness || 1);
    if (thickFrac >= VIABLE_FRAC) {
      const w = thickFrac * thickFrac * thickFrac;
      weightedXSum += bd.x * w;
      weightSum += w;
    }
  }
  // Center text on the thickness-weighted centroid (thickest point of band).
  // The viable region search provides accurate centroid across the full band.
  const viableMidX = (viableLeft + viableRight) / 2;
  const thickCenterX = weightSum > 0 ? weightedXSum / weightSum : viableMidX;

  // Pass 1: compute deformed total width for centering
  const tentativeStart = thickCenterX - approxTotalWidth / 2;
  let deformedTotalWidth = 0;
  {
    let walkX = Math.max(firstBandX, tentativeStart);
    for (let c = 0; c < text.length; c++) {
      const band = bandAtX(bandData, bandX0, bandXStep, walkX);
      const thickRatio = peakThickness > 0 ? band.thickness / peakThickness : 1;
      const charFontSize = Math.max(3, renderFontSize * Math.pow(Math.min(thickRatio, 1.8), 0.85));
      const charW = measureText(text[c], fontFamily, charFontSize).width;
      // Tighter tracking for smaller chars (larger sidebearing ratio); normal for large chars
      const tracking = 0.90 + Math.min(charFontSize, 20) * 0.005;
      deformedTotalWidth += charW * tracking;
      walkX += charW * tracking;
    }
  }

  // Deterministic jitter: shift text slightly left/right based on artist name hash
  // so labels from different artists at the same peak don't stack vertically.
  let jitterOffset = 0;
  if (jitter) {
    let jitterHash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      jitterHash ^= text.charCodeAt(i);
      jitterHash = Math.imul(jitterHash, 0x01000193);
    }
    const jitterFrac = ((jitterHash >>> 0) / 0xffffffff) * 2 - 1; // -1..1
    jitterOffset = jitterFrac * 15; // ±15px deterministic offset
  }

  const idealStart = (thickCenterX + jitterOffset) - deformedTotalWidth / 2;
  // Characters in thin areas are handled by the shrink-to-fit and center-snap in Pass 3.
  const textStartX = Math.max(firstBandX, idealStart);
  const startLen = lengthAtX(textStartX);

  // Pass 2: compute per-character sizing
  const charSizing: Array<{
    ch: string; fontSize: number; scaleY: number;
    opacity: number; width: number;
  }> = [];
  let estLen = startLen;
  for (let c = 0; c < text.length; c++) {
    const pt = getPointAtLength(Math.min(estLen, totalLen));
    const band = bandAtX(bandData, bandX0, bandXStep, pt.x);
    const localThick = band.thickness;
    const thickRatio = peakThickness > 0 ? localThick / peakThickness : 1;

    let fontSize = Math.max(3, renderFontSize * Math.pow(Math.min(thickRatio, 1.8), 0.85));
    const naturalH = fontSize * 1.2;
    let scaleY = naturalH > 0 ? Math.min(1.8, Math.max(0.5, (localThick * 0.85) / naturalH)) : 1;

    const availHalfH = (localThick * BAND_MARGIN) / 2;
    if (availHalfH > 0 && localThick > 0) {
      const bPrev = bandAtX(bandData, bandX0, bandXStep, Math.max(firstBandX, pt.x - 3));
      const bNext = bandAtX(bandData, bandX0, bandXStep, Math.min(lastBandX, pt.x + 3));
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
    const charW = measureText(text[c], fontFamily, fontSize).width;
    charSizing.push({ ch: text[c], fontSize, scaleY, opacity, width: charW });
    estLen += charW * (0.90 + Math.min(fontSize, 20) * 0.005);
  }

  // Pass 3: placement (position + angle from spline)
  const placements: CharPlacement[] = [];
  let overflowCount = 0;
  let fontSizeRatioSum = 0;
  let measuredChars = 0;

  let curLen = startLen;
  for (let c = 0; c < text.length; c++) {
    const { ch, opacity, width: charW } = charSizing[c];
    let placeFontSize = charSizing[c].fontSize;
    let placeScaleY = charSizing[c].scaleY;
    const advance = charW * (0.90 + Math.min(charSizing[c].fontSize, 20) * 0.005);

    const midLen = Math.min(curLen + charW / 2, totalLen);
    const midPt = getPointAtLength(midLen);
    const dt = 1.5;
    const p1 = getPointAtLength(Math.max(0, midLen - dt));
    const p2 = getPointAtLength(Math.min(totalLen, midLen + dt));
    const rawAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    const angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, rawAngle));

    // Shrink character to fit within band if actual rotation causes overflow
    const bounds = bandBoundsAtX
      ? bandBoundsAtX(midPt.x)
      : bandAtX(bandData, bandX0, bandXStep, midPt.x);

    // When Bezier-accurate bounds are available, snap the character's y-position
    // to the actual band center. The Hermite spline centerline can drift from the
    // real Bezier band center between data points, causing text to overflow upward.
    if (bandBoundsAtX && bounds.thickness > 0) {
      const actualCenter = (bounds.topY + bounds.botY) / 2;
      midPt.y = actualCenter;
    }

    const shrinkMargin = bandBoundsAtX ? BAND_MARGIN : 0.70;
    const availHalfH = (bounds.thickness * shrinkMargin) / 2;
    if (availHalfH > 0) {
      const rad = Math.abs(angle * Math.PI / 180);
      const cosA = Math.cos(rad); const sinA = Math.sin(rad);
      const halfW = charW / 2;
      const halfH = (placeFontSize * placeScaleY * 1.2) / 2;
      const rotatedHalfH = halfW * sinA + halfH * cosA;
      if (rotatedHalfH > availHalfH) {
        const s = availHalfH / rotatedHalfH;
        placeFontSize *= s;
        placeScaleY *= s;
      }
    }

    // Hide characters past the spline endpoint (they pile up at chart edges)
    const finalOpacity = curLen >= totalLen ? 0 : opacity;

    placements.push({ ch, x: midPt.x, y: midPt.y, fontSize: placeFontSize, scaleY: placeScaleY, angle,
      opacity: finalOpacity, width: charW });

    // Overflow detection (for reporting, uses original sizing)
    const charHalfH = (charSizing[c].fontSize * charSizing[c].scaleY * 1.2) / 2;
    const charTop = midPt.y - charHalfH;
    const charBot = midPt.y + charHalfH;
    if (charTop < bounds.topY - 1 || charBot > bounds.botY + 1) {
      overflowCount++;
    }

    if (bounds.thickness > 0) {
      fontSizeRatioSum += charSizing[c].fontSize / bounds.thickness;
      measuredChars++;
    }

    curLen += advance;
  }

  return {
    placements,
    overflowFraction: text.length > 0 ? overflowCount / text.length : 0,
    avgFontSizeRatio: measuredChars > 0 ? fontSizeRatioSum / measuredChars : 0,
  };
}
