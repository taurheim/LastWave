/**
 * Deformed text computation — extracted from WaveVisualization for testability.
 *
 * Computes per-character placement (position, fontSize, scaleY, angle, opacity)
 * for text that follows a wave band's centerline.  The heavy SVG path geometry
 * (getPointAtLength) lives here so that alternative implementations can be
 * benchmarked against the baseline without touching the component.
 */
import type { MeasureTextFn } from './util';
import type { Label } from '../models/Label';

export interface BandPoint {
  x: number;
  topY: number;
  botY: number;
  centerY: number;
  thickness: number;
}

export interface CharPlacement {
  ch: string;
  x: number;
  y: number;
  fontSize: number;
  scaleY: number;
  angle: number;
  opacity: number;
  width: number;
}

export interface DeformResult {
  placements: CharPlacement[];
  overflowFraction: number;  // 0–1, fraction of chars that exceed band bounds
  avgFontSizeRatio: number;  // avg(charFontSize / bandThickness)
}

const MAX_ANGLE = 30;
const BAND_MARGIN = 0.92;

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

/**
 * Compute deformed-text character placements using SVG path geometry.
 *
 * @param label        The label from the W/X/Y/Z algorithm
 * @param bandData     Band geometry at each data point
 * @param peakIdx      Index of the peak in bandData
 * @param peakX        X coordinate of the peak
 * @param fontFamily   CSS font family string
 * @param measureText  Canvas-based text measurer
 * @param getPointAtLength  SVG path getPointAtLength for the centerline
 * @param totalLen     Total length of the centerline path
 * @param lengthAtX    Binary-search function: x → arc length
 * @param bandBoundsAtX Optional spline-accurate band bounds for overflow detection
 */
export function computeDeformedText(
  label: Label,
  bandData: BandPoint[],
  peakIdx: number,
  peakX: number,
  fontFamily: string,
  measureText: MeasureTextFn,
  getPointAtLength: (len: number) => { x: number; y: number },
  totalLen: number,
  lengthAtX: (x: number) => number,
  bandBoundsAtX?: (x: number) => { topY: number; botY: number; thickness: number },
): DeformResult {
  const bandXStep = bandData.length > 1 ? bandData[1].x - bandData[0].x : 1;
  const bandX0 = bandData[0].x;
  const firstBandX = bandData[0].x;
  const lastBandX = bandData[bandData.length - 1].x;

  const text = label.text;
  const baseFontSize = label.fontSize;
  const peakThickness = bandData[peakIdx]?.thickness ?? 1;
  const renderFontSize = baseFontSize * 1.15;

  const approxCharWidth = renderFontSize * 0.55;
  const approxTotalWidth = text.length * approxCharWidth;

  // Thickness-weighted centroid for centering
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
      deformedTotalWidth += charW + charFontSize * 0.04;
      walkX += charW + charFontSize * 0.04;
    }
  }

  const idealStart = thickCenterX - deformedTotalWidth / 2;
  const textStartX = Math.max(firstBandX, Math.min(lastBandX - deformedTotalWidth * 0.05, idealStart));
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
    estLen += charW + fontSize * 0.04;
  }

  // Pass 3: placement (position + angle from SVG path)
  const placements: CharPlacement[] = [];
  let overflowCount = 0;
  let fontSizeRatioSum = 0;
  let measuredChars = 0;

  let curLen = startLen;
  for (let c = 0; c < text.length; c++) {
    const { ch, fontSize, scaleY, opacity, width: charW } = charSizing[c];
    const advance = charW + fontSize * 0.04;

    const midLen = Math.min(curLen + charW / 2, totalLen);
    const midPt = getPointAtLength(midLen);
    const dt = 1.5;
    const p1 = getPointAtLength(Math.max(0, midLen - dt));
    const p2 = getPointAtLength(Math.min(totalLen, midLen + dt));
    const rawAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    const angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, rawAngle));

    placements.push({ ch, x: midPt.x, y: midPt.y, fontSize, scaleY, angle, opacity, width: charW });

    // Overflow detection: does the character bounding box exceed band bounds?
    const bounds = bandBoundsAtX
      ? bandBoundsAtX(midPt.x)
      : bandAtX(bandData, bandX0, bandXStep, midPt.x);
    const charHalfH = (fontSize * scaleY * 1.2) / 2;
    const charTop = midPt.y - charHalfH;
    const charBot = midPt.y + charHalfH;
    if (charTop < bounds.topY - 1 || charBot > bounds.botY + 1) {
      overflowCount++;
    }

    if (bounds.thickness > 0) {
      fontSizeRatioSum += fontSize / bounds.thickness;
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
